import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyDocuments } from "@/lib/portal.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, File } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/documents")({ component: Page });

function Page() {
  const fn = useServerFn(listMyDocuments);
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-docs"], queryFn: () => fn(), staleTime: 30_000 });
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold">Documents</h1>
      <p className="text-sm text-muted-foreground">Files shared with you by your agent. Download links expire after 30 minutes.</p>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-8 text-muted-foreground">Loading…</div> :
          error ? <div className="p-8 text-destructive text-sm">{(error as Error).message}</div> :
          !data || data.length === 0 ? <div className="p-12 text-center text-muted-foreground">No documents shared yet.</div> :
          <ul className="divide-y">{data.map((f: any) => (
            <li key={f.name} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3"><File className="h-4 w-4 text-muted-foreground" /><div><div className="font-medium text-sm">{f.name}</div><div className="text-xs text-muted-foreground">{f.size ? `${Math.round(f.size / 1024)} KB` : ""}{f.created_at ? ` · ${new Date(f.created_at).toLocaleDateString()}` : ""}</div></div></div>
              {f.url && <Button asChild size="sm" variant="outline"><a href={f.url} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-1" /> Download</a></Button>}
            </li>
          ))}</ul>
        }
      </CardContent></Card>
    </div>
  );
}