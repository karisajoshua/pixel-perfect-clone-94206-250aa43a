import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listClientKycDocuments,
  verifyKycDocument,
  rejectKycDocument,
  setClientKycStatus,
  staffUploadKycDocument,
  staffCreateKycUploadUrl,
} from "@/lib/kyc.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Download, AlertCircle, Upload } from "lucide-react";

function badge(status?: string | null) {
  if (status === "verified") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Verified</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (status === "pending") return <Badge variant="secondary">Awaiting review</Badge>;
  return <Badge variant="outline">Not uploaded</Badge>;
}

export function ClientKycPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(listClientKycDocuments);
  const verifyFn = useServerFn(verifyKycDocument);
  const rejectFn = useServerFn(rejectKycDocument);
  const setStatusFn = useServerFn(setClientKycStatus);
  const uploadFn = useServerFn(staffUploadKycDocument);
  const createUrlFn = useServerFn(staffCreateKycUploadUrl);
  const { data, isLoading } = useQuery({
    queryKey: ["client-kyc", clientId],
    queryFn: () => fn({ data: { client_id: clientId } }),
  });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadFor = async (docType: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("File is too large (max 10 MB)"); return; }
    setBusy((b) => ({ ...b, [docType]: true }));
    let path: string | null = null;
    try {
      const signed = await createUrlFn({ data: { client_id: clientId, doc_type: docType as any, file_name: file.name } });
      path = signed.path;
      const { error: upErr } = await supabase.storage.from("client-documents")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
      await uploadFn({ data: { client_id: clientId, doc_type: docType as any, storage_path: signed.path, file_name: file.name } });
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["client-kyc", clientId] });
    } catch (e: any) {
      if (path) await supabase.storage.from("client-documents").remove([path]).catch(() => {});
      toast.error(e?.message ?? "Upload failed");
    }
    setBusy((b) => ({ ...b, [docType]: false }));
  };

  const verify = useMutation({
    mutationFn: (id: string) => verifyFn({ data: { id } }),
    onSuccess: () => { toast.success("Verified"); qc.invalidateQueries({ queryKey: ["client-kyc", clientId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectFn({ data: { id, reason } }),
    onSuccess: () => { toast.success("Rejected — client will be notified"); qc.invalidateQueries({ queryKey: ["client-kyc", clientId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (status: "verified" | "rejected" | "pending") =>
      setStatusFn({ data: { client_id: clientId, status } }),
    onSuccess: () => {
      toast.success("Client KYC updated");
      qc.invalidateQueries({ queryKey: ["client-kyc", clientId] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Overall KYC status</div>
            <div className="text-xs text-muted-foreground capitalize">{data.kycStatus.replace("_", " ")}</div>
            <div className="text-xs text-muted-foreground mt-1">Vehicle paperwork (log book, importation, search) is verified per vehicle in the Vehicles tab.</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setStatus.mutate("verified")} disabled={setStatus.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Mark verified
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("pending")} disabled={setStatus.isPending}>
              Reset to pending
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        {data.items.map((item) => (
          <Card key={item.doc_type} className={item.row?.status === "rejected" ? "border-destructive/60" : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                <span>{item.label} {item.required ? <span className="text-destructive">*</span> : <span className="text-muted-foreground text-xs ml-1">(optional)</span>}</span>
                {badge(item.row?.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={(el) => { inputRefs.current[item.doc_type] = el; }}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFor(item.doc_type, f);
                  if (inputRefs.current[item.doc_type]) inputRefs.current[item.doc_type]!.value = "";
                }}
              />
              {!item.row ? (
                <>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  <Button size="sm" variant="outline" onClick={() => inputRefs.current[item.doc_type]?.click()} disabled={busy[item.doc_type]}>
                    <Upload className="h-4 w-4 mr-1" /> {busy[item.doc_type] ? "Uploading…" : "Upload on behalf of client"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2 text-xs">
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
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => verify.mutate(item.row.id)} disabled={item.row.status === "verified"}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Verify
                      </Button>
                      <Button size="sm" variant="destructive"
                        onClick={() => {
                          const reason = reasons[item.row.id]?.trim();
                          if (!reason) return toast.error("Add a rejection reason first");
                          reject.mutate({ id: item.row.id, reason });
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => inputRefs.current[item.doc_type]?.click()} disabled={busy[item.doc_type]}>
                        <Upload className="h-4 w-4 mr-1" /> {busy[item.doc_type] ? "Uploading…" : "Replace"}
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Rejection reason (required to reject)"
                      value={reasons[item.row.id] ?? item.row.rejection_reason ?? ""}
                      onChange={(e) => setReasons((r) => ({ ...r, [item.row.id]: e.target.value }))}
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}