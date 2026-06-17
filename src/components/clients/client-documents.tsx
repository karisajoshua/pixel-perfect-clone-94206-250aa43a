import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Download } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

export function ClientDocuments({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: files, isLoading } = useQuery({
    queryKey: ["client-docs", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("client-documents").list(clientId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${clientId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("client-documents").upload(path, file);
    if (error) return toast.error(error.message);
    toast.success("File uploaded");
    qc.invalidateQueries({ queryKey: ["client-docs", clientId] });
    if (fileRef.current) fileRef.current.value = "";
  };

  const download = async (name: string) => {
    const { data, error } = await supabase.storage.from("client-documents").createSignedUrl(`${clientId}/${name}`, 60);
    if (error || !data) return toast.error("Could not download");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (name: string) => {
    const { error } = await supabase.storage.from("client-documents").remove([`${clientId}/${name}`]);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["client-docs", clientId] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>KYC & policy documents</CardTitle>
        <div>
          <input ref={fileRef} type="file" className="hidden" onChange={upload} />
          <Button size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Upload</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && files?.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
        <ul className="divide-y">
          {files?.map((f) => (
            <li key={f.name} className="flex items-center justify-between py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{f.name}</span></div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => download(f.name)}><Download className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(f.name)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}