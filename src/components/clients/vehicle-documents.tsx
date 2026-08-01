import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listVehicleKycDocuments,
  staffUploadKycDocument,
  staffCreateKycUploadUrl,
  verifyKycDocument,
  rejectKycDocument,
} from "@/lib/kyc.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Download, AlertCircle, Upload } from "lucide-react";

function slotBadge(status?: string | null) {
  if (status === "verified") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Verified</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (status === "pending") return <Badge variant="secondary">Awaiting review</Badge>;
  return <Badge variant="outline">Not uploaded</Badge>;
}

export function vehicleDocsBadge(items?: any[]) {
  if (!items) return null;
  const uploaded = items.filter((i) => i.row);
  if (uploaded.length === 0) return <Badge variant="outline">Documents missing</Badge>;
  if (uploaded.some((i) => i.row.status === "rejected")) return <Badge variant="destructive">Document rejected</Badge>;
  if (uploaded.some((i) => i.row.status === "verified")) return <Badge className="bg-emerald-600 hover:bg-emerald-600">Documents verified</Badge>;
  return <Badge variant="secondary">Awaiting review</Badge>;
}

export function useVehicleDocuments(vehicleIds: string[]) {
  const fn = useServerFn(listVehicleKycDocuments);
  return useQuery({
    queryKey: ["vehicle-kyc", vehicleIds.join(",")],
    queryFn: () => fn({ data: { vehicle_ids: vehicleIds } }),
    enabled: vehicleIds.length > 0,
  });
}

export function VehicleDocuments({
  clientId,
  vehicleId,
  items,
  queryKey,
}: {
  clientId: string;
  vehicleId: string;
  items: any[];
  queryKey: any[];
}) {
  const qc = useQueryClient();
  const uploadFn = useServerFn(staffUploadKycDocument);
  const createUrlFn = useServerFn(staffCreateKycUploadUrl);
  const verifyFn = useServerFn(verifyKycDocument);
  const rejectFn = useServerFn(rejectKycDocument);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const refresh = () => qc.invalidateQueries({ queryKey });

  const verify = useMutation({
    mutationFn: (id: string) => verifyFn({ data: { id } }),
    onSuccess: () => { toast.success("Verified"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectFn({ data: { id, reason } }),
    onSuccess: () => { toast.success("Rejected"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadFor = async (docType: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("File is too large (max 10 MB)"); return; }
    setBusy((b) => ({ ...b, [docType]: true }));
    let path: string | null = null;
    try {
      const signed = await createUrlFn({ data: { client_id: clientId, vehicle_id: vehicleId, doc_type: docType as any, file_name: file.name } });
      path = signed.path;
      const { error: upErr } = await supabase.storage.from("client-documents")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
      await uploadFn({ data: { client_id: clientId, vehicle_id: vehicleId, doc_type: docType as any, storage_path: signed.path, file_name: file.name } });
      toast.success("Uploaded");
      refresh();
    } catch (e: any) {
      if (path) await supabase.storage.from("client-documents").remove([path]).catch(() => {});
      toast.error(e?.message ?? "Upload failed");
    }
    setBusy((b) => ({ ...b, [docType]: false }));
  };

  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.doc_type} className={`rounded-md border p-3 space-y-2 ${item.row?.status === "rejected" ? "border-destructive/60" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium">{item.label}</span>
            {slotBadge(item.row?.status)}
          </div>
          <input
            ref={(el) => { inputRefs.current[item.doc_type] = el; }}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,image/jpeg,image/png,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFor(item.doc_type, f);
              if (inputRefs.current[item.doc_type]) inputRefs.current[item.doc_type]!.value = "";
            }}
          />
          {item.row ? (
            <>
              <div className="flex items-center justify-between gap-2 rounded bg-muted/30 p-2 text-xs">
                <span className="truncate">{item.row.file_name ?? "File"}</span>
                {item.url && (
                  <a className="text-primary inline-flex items-center gap-1 shrink-0" href={item.url} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" /> View
                  </a>
                )}
              </div>
              {item.row.status === "rejected" && item.row.rejection_reason && (
                <div className="text-xs text-destructive flex gap-1.5 items-start">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{item.row.rejection_reason}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => verify.mutate(item.row.id)} disabled={item.row.status === "verified"}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Verify
                </Button>
                <Button size="sm" variant="destructive"
                  onClick={() => {
                    const reason = reasons[item.row.id]?.trim();
                    if (!reason) return toast.error("Add a rejection reason first");
                    reject.mutate({ id: item.row.id, reason });
                  }}>
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button size="sm" variant="outline" onClick={() => inputRefs.current[item.doc_type]?.click()} disabled={busy[item.doc_type]}>
                  <Upload className="h-4 w-4 mr-1" /> {busy[item.doc_type] ? "Uploading…" : "Replace"}
                </Button>
              </div>
              <Textarea
                placeholder="Rejection reason"
                rows={2}
                className="text-xs"
                value={reasons[item.row.id] ?? item.row.rejection_reason ?? ""}
                onChange={(e) => setReasons((r) => ({ ...r, [item.row.id]: e.target.value }))}
              />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              <Button size="sm" variant="outline" onClick={() => inputRefs.current[item.doc_type]?.click()} disabled={busy[item.doc_type]}>
                <Upload className="h-4 w-4 mr-1" /> {busy[item.doc_type] ? "Uploading…" : "Upload"}
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}