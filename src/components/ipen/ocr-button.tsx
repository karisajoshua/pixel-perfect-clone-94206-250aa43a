import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ScanLine } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ipenOcrExtract } from "@/lib/ipen/ocr.functions";
import { toast } from "sonner";

type Props = {
  documentType: string;
  label?: string;
  onExtracted: (fields: Record<string, any>) => void;
  accept?: string;
};

// Reads a file, base64-encodes it in the browser, calls the IPEN OCR
// endpoint via a server function, and hands the parsed fields back to the
// caller for form autofill. The bearer token stays server-side.
export function IpenOcrButton({
  documentType,
  label = "Scan document",
  onExtracted,
  accept = "image/*,application/pdf",
}: Props) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fn = useServerFn(ipenOcrExtract);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Chunked binary→base64 to avoid stack overflow on large files.
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
      }
      const fileBase64 = btoa(bin);
      const res = await fn({
        data: {
          documentType,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileBase64,
        },
      });
      onExtracted((res as any)?.data ?? res ?? {});
      toast.success("Document scanned");
    } catch (e: any) {
      toast.error(e?.message ?? "OCR failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <ScanLine className="h-4 w-4 mr-1" />
        )}
        {label}
      </Button>
    </>
  );
}