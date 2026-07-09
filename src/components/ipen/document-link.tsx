import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getIpenDocument } from "@/lib/ipen/documents.functions";
import { toast } from "sonner";

export function IpenDocumentLink({
  documentKey,
  label = "Open document",
}: {
  documentKey: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(getIpenDocument);

  const open = async () => {
    setBusy(true);
    try {
      const res = await fn({ data: { key: documentKey } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open document");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={open}>
      {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
      {label}
    </Button>
  );
}