import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlatformNotices, deletePlatformNotice, getPlatformOverview } from "@/lib/platform.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SendNoticeDialog } from "@/components/platform/send-notice-dialog";
import { Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_platform/platform/notices")({
  head: () => ({ meta: [{ title: "Notices — Platform" }] }),
  component: NoticesPage,
});

function NoticesPage() {
  const listFn = useServerFn(listPlatformNotices);
  const overviewFn = useServerFn(getPlatformOverview);
  const delFn = useServerFn(deletePlatformNotice);
  const qc = useQueryClient();
  const { data: notices } = useQuery({ queryKey: ["platform-notices"], queryFn: () => listFn() });
  const { data: overview } = useQuery({ queryKey: ["platform-overview"], queryFn: () => overviewFn() });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["platform-notices"] }); },
  });

  const sevVariant = (s: string) => s === "critical" ? "destructive" : s === "warning" ? "secondary" : "outline";

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Notices</h1>
          <p className="text-sm text-muted-foreground">Broadcast messages to one agency or every agency on the platform.</p>
        </div>
        <SendNoticeDialog
          agencies={overview?.agencies ?? []}
          trigger={<Button><Megaphone className="h-4 w-4 mr-2" /> New notice</Button>}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>{notices?.length ?? 0} sent</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Message</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(notices ?? []).map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="whitespace-nowrap text-sm">{new Date(n.created_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{n.audience === "all" ? "All agencies" : n.tenant_name ?? "—"}</Badge></TableCell>
                  <TableCell><Badge variant={sevVariant(n.severity) as any}>{n.severity}</Badge></TableCell>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">{n.body}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this notice?")) del.mutate(n.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!notices || notices.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No notices yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}