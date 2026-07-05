import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgencyDetail, setAgencyStatus, setAgencyPlan } from "@/lib/platform.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SendNoticeDialog } from "@/components/platform/send-notice-dialog";
import { Megaphone } from "lucide-react";
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
  const planFn = useServerFn(setAgencyPlan);
  const { data } = useQuery({ queryKey: ["agency-detail", id], queryFn: () => fetchFn({ data: { id } }) });
  const t = data?.tenant as any;
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

  const toggle = async () => {
    const next = t?.status === "active" ? "suspended" : "active";
    if (!confirm(`Change status to ${next}?`)) return;
    await statusFn({ data: { id, status: next } });
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["agency-detail", id] });
    qc.invalidateQueries({ queryKey: ["platform-overview"] });
  };

  const changePlan = async (plan: string) => {
    await planFn({ data: { id, plan: plan as any } });
    toast.success("Plan updated");
    qc.invalidateQueries({ queryKey: ["agency-detail", id] });
    qc.invalidateQueries({ queryKey: ["platform-overview"] });
  };

  if (!t) return <div className="p-8">Loading…</div>;

  const maxMonthly = Math.max(1, ...(data?.monthlyRevenue ?? []).map((m: any) => m.total));

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

      <Card>
        <CardHeader><CardTitle>Super admin actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <label className="text-xs text-muted-foreground">Plan</label>
            <Select value={t.plan ?? "starter"} onValueChange={changePlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SendNoticeDialog
            agencies={[{ id, name: t.name }]}
            defaultTenantId={id}
            trigger={<Button><Megaphone className="h-4 w-4 mr-2" /> Send notice to this agency</Button>}
          />
          <Button variant="outline" onClick={toggle}>
            {t.status === "active" ? "Suspend agency" : "Reactivate agency"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Revenue — last 6 months</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-40">
            {(data?.monthlyRevenue ?? []).map((m: any) => (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-muted-foreground">{fmt(m.total)}</div>
                <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(m.total / maxMonthly) * 100}%`, minHeight: 2 }} />
                <div className="text-xs text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent invoices</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.recentInvoices ?? []).map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.invoice_no}</TableCell>
                    <TableCell className="text-sm">{i.issue_date ? new Date(i.issue_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(Number(i.total ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {(!data?.recentInvoices || data.recentInvoices.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No invoices yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent claims</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.recentClaims ?? []).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.claim_no}</TableCell>
                    <TableCell className="text-sm">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(Number(c.claim_amount ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {(!data?.recentClaims || data.recentClaims.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No claims yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
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

      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.auditLog ?? []).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{a.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.entity_type ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(!data?.auditLog || data.auditLog.length === 0) && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No activity yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}