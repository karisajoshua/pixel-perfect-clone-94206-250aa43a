import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgencyDetail, setAgencyStatus } from "@/lib/platform.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_platform/platform/agencies/$id")({
  head: () => ({ meta: [{ title: "Agency detail" }] }),
  component: AgencyDetail,
});

function AgencyDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAgencyDetail);
  const statusFn = useServerFn(setAgencyStatus);
  const { data } = useQuery({ queryKey: ["agency-detail", id], queryFn: () => fetchFn({ data: { id } }) });
  const t = data?.tenant as any;

  const toggle = async () => {
    const next = t?.status === "active" ? "suspended" : "active";
    if (!confirm(`Change status to ${next}?`)) return;
    await statusFn({ data: { id, status: next } });
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["agency-detail", id] });
    qc.invalidateQueries({ queryKey: ["platform-overview"] });
  };

  if (!t) return <div className="p-8">Loading…</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/platform/agencies" className="text-sm text-muted-foreground hover:underline">← All agencies</Link>
          <h1 className="text-2xl font-bold mt-1">{t.name}</h1>
          <p className="text-sm text-muted-foreground">{t.contact_email} · {t.city ?? "—"}, {t.country ?? "—"}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant={t.status === "active" ? "default" : "destructive"}>{t.status}</Badge>
          <Button variant="outline" onClick={toggle}>{t.status === "active" ? "Suspend" : "Activate"}</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Clients</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.clientCount ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Policies</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.policyCount ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Active policies</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.activePolicyCount ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Branches</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.branches.length ?? 0}</div></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Team</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.members ?? []).map((m) => (
                  <TableRow key={m.user_id}><TableCell>{m.full_name}</TableCell><TableCell>{m.email}</TableCell><TableCell><Badge variant="outline">{m.role}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Underwriters ({data?.insurers.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(data?.insurers ?? []).map((i: any) => <Badge key={i.id} variant="secondary">{i.name}</Badge>)}
            {(!data?.insurers || data.insurers.length === 0) && <p className="text-sm text-muted-foreground">None selected.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Branches</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.branches ?? []).map((b: any) => (
                <TableRow key={b.id}><TableCell>{b.name}</TableCell><TableCell>{b.is_active ? "Yes" : "No"}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}