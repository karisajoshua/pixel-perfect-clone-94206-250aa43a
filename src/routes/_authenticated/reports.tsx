import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, FileText, Printer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/use-auth";
import { getReportsSummary, type ReportsSummary } from "@/lib/reports.functions";
import logoRed from "@/assets/zia-logo-red.png.asset.json";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n || 0);

const COLORS = ["#0f172a", "#dc2626", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function ReportsPage() {
  const { data: roles } = useMyRoles();
  const allowed = roles?.some((r) => r === "admin" || r === "manager") ?? false;
  const isAdmin = roles?.includes("admin") ?? false;

  const [{ from, to }, setRange] = useState(defaultRange());
  const [branchId, setBranchId] = useState<string>("all");

  const fetchReport = useServerFn(getReportsSummary);
  const branchesQ = useQuery({
    queryKey: ["branches-list"],
    queryFn: async () => (await supabase.from("branches").select("id, name").order("name")).data ?? [],
  });
  const report = useQuery({
    queryKey: ["reports", from, to, branchId],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: () => fetchReport({ data: { from, to, branchId: branchId === "all" ? null : branchId } }),
  });

  const csv = useMemo(() => (report.data ? buildCsv(report.data) : ""), [report.data]);

  if (roles && !allowed) {
    return (
      <div className="p-8">
        <PageHeader title="Reports & analytics" subtitle="Restricted area." />
        <Card className="mt-6"><CardContent className="py-12 text-center text-muted-foreground">Reports are available to admins and managers.</CardContent></Card>
      </div>
    );
  }

  const downloadCsv = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zia-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => window.print();

  return (
    <div className="p-8 space-y-6 print:p-0">
      <div className="hidden print:flex items-center justify-between border-b pb-4 mb-4">
        <img src={logoRed.url} alt="Zest Insurance Agency" className="h-16 w-auto" />
        <div className="text-right text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">Reports & Analytics</div>
          <div>{from} — {to}</div>
          <div>Generated {new Date().toLocaleString()}</div>
        </div>
      </div>
      <PageHeader
        title="Reports & analytics"
        subtitle="Revenue, portfolio, claims and team performance for the selected period."
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!report.data}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" size="sm" onClick={print} disabled={!report.data}><Printer className="h-4 w-4 mr-2" />Print / PDF</Button>
          </div>
        }
      />

      <Card className="print:hidden">
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Branch</Label>
            {isAdmin ? (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {(branchesQ.data ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted/40 text-sm text-muted-foreground">
                {report.data?.branchPerformance?.[0]?.branch ?? "Your branch"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {report.isLoading || !report.data ? (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <Kpis data={report.data} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel className="lg:col-span-2" title="Revenue over time">
              {report.data.revenueOverTime.length === 0 ? <Empty msg="No payments recorded in this period." /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={report.data.revenueOverTime} margin={{ left: 10, right: 10, top: 10 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                    <Tooltip formatter={(v: number) => fmtKES(v)} />
                    <Area type="monotone" dataKey="revenue" stroke="#dc2626" fill="url(#rev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Panel>
            <Panel title="Policies by status">
              {report.data.policiesByStatus.length === 0 ? <Empty msg="No policies yet." /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={report.data.policiesByStatus} dataKey="count" nameKey="status" outerRadius={90} innerRadius={50} paddingAngle={2}>
                      {report.data.policiesByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Insurer portfolio (premium written)">
              {report.data.insurerShare.length === 0 ? <Empty msg="No insurer activity yet." /> : (
                <ResponsiveContainer width="100%" height={Math.max(220, report.data.insurerShare.length * 28)}>
                  <BarChart data={report.data.insurerShare} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="insurer" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip formatter={(v: number) => fmtKES(v)} />
                    <Bar dataKey="premium" fill="#0f172a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
            <Panel title="Claims funnel">
              {report.data.claimsFunnel.every((c) => c.count === 0) ? <Empty msg="No claims in this period." /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={report.data.claimsFunnel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {isAdmin ? (
              <DataTable title="Branch performance" head={["Branch", "Policies", "Premium", "Claims"]} rows={report.data.branchPerformance.map((b) => [b.branch, b.policies, fmtKES(b.premium), b.claims])} />
            ) : (
              <DataTable title="Branch performance" head={["Branch", "Policies", "Claims"]} rows={(report.data.branchPerformanceAll ?? []).map((b) => [b.branch, b.policies, b.claims])} />
            )}
            <DataTable title="Top agents" head={["Agent", "Policies", "Premium"]} rows={report.data.topAgents.map((a) => [a.agent, a.policies, fmtKES(a.premium)])} />
          </div>
        </>
      )}
    </div>
  );
}

function Kpis({ data }: { data: ReportsSummary }) {
  const items = [
    { label: "Revenue", value: fmtKES(data.kpis.revenue) },
    { label: "Active policies", value: data.kpis.activePolicies.toLocaleString() },
    { label: "New clients", value: data.kpis.newClients.toLocaleString() },
    { label: "Open claims", value: data.kpis.openClaims.toLocaleString() },
    { label: "Renewal hit rate", value: `${Math.round(data.kpis.renewalHitRate * 100)}%` },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map((k) => (
        <Card key={k.label}><CardContent className="pt-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
          <div className="mt-2 text-2xl font-bold">{k.value}</div>
        </CardContent></Card>
      ))}
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="h-[200px] grid place-items-center text-sm text-muted-foreground">{msg}</div>;
}

function DataTable({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No data</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">{head.map((h) => <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-b-0">{r.map((c, j) => <td key={j} className="px-4 py-2">{c}</td>)}</tr>)}</tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function buildCsv(d: ReportsSummary): string {
  const lines: string[] = [];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  lines.push("Zest Insurance Agency — Report");
  lines.push(`Period,${d.range.from},${d.range.to}`);
  lines.push("");
  lines.push("KPI,Value");
  lines.push(`Revenue,${d.kpis.revenue}`);
  lines.push(`Active policies,${d.kpis.activePolicies}`);
  lines.push(`New clients,${d.kpis.newClients}`);
  lines.push(`Open claims,${d.kpis.openClaims}`);
  lines.push(`Renewal hit rate,${(d.kpis.renewalHitRate * 100).toFixed(1)}%`);
  lines.push("");
  lines.push("Revenue by month,Amount");
  d.revenueOverTime.forEach((r) => lines.push(`${r.month},${r.revenue}`));
  lines.push("");
  lines.push("Insurer,Premium written");
  d.insurerShare.forEach((r) => lines.push(`${esc(r.insurer)},${r.premium}`));
  lines.push("");
  lines.push("Branch,Policies,Premium,Claims");
  d.branchPerformance.forEach((b) => lines.push(`${esc(b.branch)},${b.policies},${b.premium},${b.claims}`));
  lines.push("");
  lines.push("Agent,Policies,Premium");
  d.topAgents.forEach((a) => lines.push(`${esc(a.agent)},${a.policies},${a.premium}`));
  return lines.join("\n");
}