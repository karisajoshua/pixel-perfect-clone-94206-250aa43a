import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  getMyRequiredDocuments,
  recordKycUpload,
  removeKycUpload,
  submitKycForReview,
  createKycUploadUrl,
  type KycDocType,
} from "@/lib/kyc.functions";
import { listMyDocuments } from "@/lib/portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Download,
  File as FileIcon,
  Upload,
  Trash2,
  AlertCircle,
  Clock,
  Send,
} from "lucide-react";

export const Route = createFileRoute("/_portal/portal/documents")({ component: Page });

function statusBadge(status?: string | null) {
  if (status === "verified") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Verified</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (status === "pending") return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Awaiting review</Badge>;
  return <Badge variant="outline">Not uploaded</Badge>;
}

function Page() {
  const qc = useQueryClient();
  const fn = useServerFn(getMyRequiredDocuments);
  const recordFn = useServerFn(recordKycUpload);
  const removeFn = useServerFn(removeKycUpload);
  const submitFn = useServerFn(submitKycForReview);
  const createUrlFn = useServerFn(createKycUploadUrl);
  const sharedFn = useServerFn(listMyDocuments);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-kyc"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  const { data: shared } = useQuery({
    queryKey: ["portal-docs"],
    queryFn: () => sharedFn(),
    staleTime: 30_000,
  });

  const submit = useMutation({
    mutationFn: () => submitFn(),
    onSuccess: () => {
      toast.success("Submitted for review — we'll email you when it's done");
      qc.invalidateQueries({ queryKey: ["portal-kyc"] });
      qc.invalidateQueries({ queryKey: ["portal-overview"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not submit"),
  });

  const pct = data && data.requiredTotal > 0 ? Math.round((data.requiredDone / data.requiredTotal) * 100) : 0;
  const locked = data?.kycStatus === "in_review" || data?.kycStatus === "verified";

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">KYC documents</h1>
        <p className="text-sm text-muted-foreground">
          Upload each required document below. Once everything is in, submit your file for review.
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>{(error as Error).message}</span>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm font-medium">
                  {data.requiredDone} of {data.requiredTotal} required documents uploaded
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  Status: {data.kycStatus.replace("_", " ")}
                </div>
              </div>
              <Button
                onClick={() => submit.mutate()}
                disabled={!data.canSubmit || submit.isPending}
              >
                <Send className="h-4 w-4 mr-1.5" />
                {data.kycStatus === "in_review" ? "Submitted — awaiting review" : data.kycStatus === "verified" ? "KYC verified" : "Submit for review"}
              </Button>
            </div>
            <Progress value={pct} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="p-8 text-muted-foreground text-sm">Loading…</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {data?.items.map((item) => (
            <DocSlot
              key={item.doc_type}
              clientId={data.clientId}
              docType={item.doc_type}
              label={item.label}
              description={item.description}
              required={item.required}
              row={item.row}
              url={item.url}
              locked={locked}
              createUploadUrl={(file_name) => createUrlFn({ data: { doc_type: item.doc_type, file_name } })}
              onUploaded={async (path, file_name) => {
                await recordFn({ data: { doc_type: item.doc_type, storage_path: path, file_name } });
                qc.invalidateQueries({ queryKey: ["portal-kyc"] });
                qc.invalidateQueries({ queryKey: ["portal-overview"] });
              }}
              onRemove={async () => {
                await removeFn({ data: { doc_type: item.doc_type } });
                qc.invalidateQueries({ queryKey: ["portal-kyc"] });
                qc.invalidateQueries({ queryKey: ["portal-overview"] });
              }}
            />
          ))}
        </div>
      )}

      {(shared ?? []).filter((f: any) => f.folder === "shared").length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Shared by your agent</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {shared!.filter((f: any) => f.folder === "shared").map((f: any) => (
                <li key={f.path} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.created_at ? new Date(f.created_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </div>
                  {f.url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={f.url} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Download</span>
                      </a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type SlotProps = {
  clientId: string;
  docType: KycDocType;
  label: string;
  description: string;
  required: boolean;
  row: any;
  url: string | null;
  locked: boolean;
  createUploadUrl: (fileName: string) => Promise<{ path: string; token: string }>;
  onUploaded: (path: string, fileName: string) => Promise<void>;
  onRemove: () => Promise<void>;
};

function DocSlot({ clientId: _clientId, docType, label, description, required, row, url, locked, createUploadUrl, onUploaded, onRemove }: SlotProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large (max 10 MB)");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setBusy(true);
    let path: string | null = null;
    try {
      const signed = await createUploadUrl(file.name);
      path = signed.path;
      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (upErr) throw upErr;
      await onUploaded(signed.path, file.name);
      toast.success(`${label} uploaded`);
    } catch (err: any) {
      if (path) await supabase.storage.from("client-documents").remove([path]).catch(() => {});
      toast.error(err?.message ?? "Upload failed");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const remove = async () => {
    if (!confirm(`Remove your ${label}?`)) return;
    setBusy(true);
    try {
      await onRemove();
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e.message ?? "Could not remove");
    }
    setBusy(false);
  };

  return (
    <Card className={row?.status === "rejected" ? "border-destructive/60" : undefined}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-medium">{label}</h3>
              {required ? <Badge variant="outline" className="text-[10px]">Required</Badge> : <Badge variant="outline" className="text-[10px]">Optional</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <div className="shrink-0">{statusBadge(row?.status)}</div>
        </div>

        {row?.status === "rejected" && row.rejection_reason && (
          <div className="text-xs text-destructive flex gap-1.5 items-start">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{row.rejection_reason}</span>
          </div>
        )}

        {row?.storage_path && (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{row.file_name ?? "Uploaded file"}</span>
            </div>
            {url && (
              <a className="text-primary inline-flex items-center gap-1 shrink-0" href={url} target="_blank" rel="noreferrer">
                <Download className="h-3.5 w-3.5" /> View
              </a>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onFile} />
        <div className="flex gap-2">
          {!locked && (
            <Button size="sm" variant={row ? "outline" : "default"} onClick={pick} disabled={busy}>
              {row?.status === "verified" ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
              {busy ? "Uploading…" : row ? "Replace" : "Upload"}
            </Button>
          )}
          {row && !locked && row.status !== "verified" && (
            <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}