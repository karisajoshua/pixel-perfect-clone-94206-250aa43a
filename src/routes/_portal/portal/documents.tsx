import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { listMyDocuments, getPortalOverview } from "@/lib/portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, File, Upload, Trash2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_portal/portal/documents")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const fn = useServerFn(listMyDocuments);
  const overviewFn = useServerFn(getPortalOverview);
  const { data: overview } = useQuery({ queryKey: ["portal-overview"], queryFn: () => overviewFn(), staleTime: 60_000 });
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-docs"], queryFn: () => fn(), staleTime: 30_000 });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const clientId = overview?.client?.id as string | undefined;

  const onPick = () => fileRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large (max 10 MB)");
      return;
    }
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${clientId}/kyc/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (upErr) return toast.error(upErr.message);
    toast.success("Uploaded — our team will review it shortly");
    qc.invalidateQueries({ queryKey: ["portal-docs"] });
    qc.invalidateQueries({ queryKey: ["portal-overview"] });
  };

  const remove = async (path: string) => {
    if (!confirm("Remove this file?")) return;
    const { error: delErr } = await supabase.storage.from("client-documents").remove([path]);
    if (delErr) return toast.error(delErr.message);
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["portal-docs"] });
    qc.invalidateQueries({ queryKey: ["portal-overview"] });
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">Upload your KYC documents and download files shared by your agent.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" className="hidden" onChange={onFile} accept="image/*,application/pdf" />
          <Button onClick={onPick} disabled={uploading || !clientId}>
            <Upload className="h-4 w-4 mr-1.5" /> {uploading ? "Uploading…" : "Upload document"}
          </Button>
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> What we need for KYC
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-1">
          <p>• Copy of your National ID (front &amp; back) or Passport</p>
          <p>• KRA PIN certificate</p>
          <p>• A recent utility bill or bank statement (proof of address)</p>
          <p className="pt-1">Accepted: PDF or image. Max 10 MB per file.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="p-8 text-destructive text-sm">{(error as Error).message}</div>
          ) : !data || data.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No documents yet. Use “Upload document” to send us your KYC.</div>
          ) : (
            <ul className="divide-y">
              {data.map((f: any) => (
                <li key={f.path} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <File className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.folder === "kyc" ? "Your upload" : "Shared by agent"}
                        {f.size ? ` · ${Math.round(f.size / 1024)} KB` : ""}
                        {f.created_at ? ` · ${new Date(f.created_at).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {f.url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={f.url} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Download</span>
                        </a>
                      </Button>
                    )}
                    {f.canDelete && (
                      <Button size="sm" variant="ghost" onClick={() => remove(f.path)} aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}