import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, Printer, TrendingUp } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & analytics — Zest Insurance" },
      { name: "description", content: "Agency revenue, new business, portfolio, claims and team performance reports." },
      { property: "og:title", content: "Reports & analytics — Zest Insurance" },
      { property: "og:description", content: "Agency revenue, new business, portfolio, claims and team performance reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n || 0);

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const shortMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en-KE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
};

const compactNumber = (value: number) => new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(value);

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

  const csv = useMemo(() => (report.data ? buildCsv(report.data, isAdmin) : ""), [report.data, isAdmin]);

  if (roles && !allowed) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
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
    <div className="space-y-5 p-4 sm:p-6 lg:space-y-6 lg:p-8 print:p-0">
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
          <div className="grid grid-cols-2 gap-2 print:hidden sm:flex">
            <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!report.data}><Download className="mr-2 h-4 w-4" />CSV</Button>
            <Button variant="outline" size="sm" onClick={print} disabled={!report.data}><Printer className="mr-2 h-4 w-4" />Print / PDF</Button>
          </div>
        }
      />

      <Card className="print:hidden">
        <CardContent className="grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4 lg:pt-6">
          <div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <Kpis data={report.data} />
           <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-2" title="Revenue over time">
               {report.data.revenueOverTime.length === 0 ? <Empty msg="No payments recorded in this period." /> : (
                 <div className="h-64 w-full sm:h-72" role="img" aria-label="Revenue paid by month"><ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={report.data.revenueOverTime} margin={{ left: -18, right: 8, top: 10 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                         <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                     <CartesianGrid vertical={false} stroke="var(--border)" />
                     <XAxis dataKey="month" tickFormatter={shortMonth} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={18} />
                     <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={compactNumber} />
                     <Tooltip formatter={(v: number) => fmtKES(v)} labelFormatter={(v) => shortMonth(String(v))} contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", borderRadius: 8 }} />
                     <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--chart-1)" fill="url(#rev)" strokeWidth={2.5} />
                  </AreaChart>
                 </ResponsiveContainer></div>
              )}
            </Panel>
            <Panel title="Policies by status">
              {report.data.policiesByStatus.length === 0 ? <Empty msg="No policies yet." /> : (
                 <div className="h-64 w-full sm:h-72" role="img" aria-label="Policies grouped by status"><ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={report.data.policiesByStatus} dataKey="count" nameKey="status" outerRadius={90} innerRadius={50} paddingAngle={2}>
                      {report.data.policiesByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                     <Tooltip contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", borderRadius: 8 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                 </ResponsiveContainer></div>
              )}
            </Panel>
          </div>

           <Panel title="New business per month" icon={<TrendingUp className="h-5 w-5 text-primary" />}>
             {report.data.newBusinessByMonth.every((item) => item.policies === 0) ? <Empty msg="No first-time policies in this period." /> : (
               <div className="h-72 w-full sm:h-80" role="img" aria-label="First-time policy count and gross premium by month">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={report.data.newBusinessByMonth} margin={{ left: -18, right: 4, top: 12 }}>
                     <CartesianGrid vertical={false} stroke="var(--border)" />
                     <XAxis dataKey="month" tickFormatter={shortMonth} tickLine={false} axisLine={false} minTickGap={18} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                     <YAxis yAxisId="policies" allowDecimals={false} tickLine={false} axisLine={false} width={38} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                     <YAxis yAxisId="premium" orientation="right" tickLine={false} axisLine={false} width={48} tickFormatter={compactNumber} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                     <Tooltip labelFormatter={(v) => shortMonth(String(v))} formatter={(value: number, name: string) => name === "Gross premium" ? fmtKES(value) : value.toLocaleString()} contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", borderRadius: 8 }} />
                     <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                     <Bar yAxisId="policies" dataKey="policies" name="New policies" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={44} />
                     <Area yAxisId="premium" type="monotone" dataKey="premium" name="Gross premium" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.08} strokeWidth={2.5} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             )}
             <p className="sr-only">{report.data.kpis.newBusiness} first-time policies worth {fmtKES(report.data.kpis.newBusinessPremium)} in the selected period.</p>
           </Panel>

           <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Insurer portfolio (premium written)">
              {report.data.insurerShare.length === 0 ? <Empty msg="No insurer activity yet." /> : (
                 <div className="w-full overflow-hidden" role="img" aria-label="Gross premium grouped by insurer"><ResponsiveContainer width="100%" height={Math.max(240, report.data.insurerShare.length * 32)}>
                   <BarChart data={report.data.insurerShare} layout="vertical" margin={{ left: 0, right: 8 }}>
                     <CartesianGrid horizontal={false} stroke="var(--border)" />
                     <XAxis type="number" tickFormatter={compactNumber} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                     <YAxis type="category" dataKey="insurer" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={96} tickLine={false} axisLine={false} />
                     <Tooltip formatter={(v: number) => fmtKES(v)} contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", borderRadius: 8 }} />
                     <Bar dataKey="premium" name="Premium" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                 </ResponsiveContainer></div>
              )}
            </Panel>
            <Panel title="Claims funnel">
              {report.data.claimsFunnel.every((c) => c.count === 0) ? <Empty msg="No claims in this period." /> : (
                 <div className="h-64 w-full sm:h-72" role="img" aria-label="Claims grouped by processing stage"><ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.data.claimsFunnel}>
                     <CartesianGrid vertical={false} stroke="var(--border)" />
                     <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                     <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                     <Tooltip contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", borderRadius: 8 }} />
                     <Bar dataKey="count" name="Claims" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={56} />
                  </BarChart>
                 </ResponsiveContainer></div>
              )}
            </Panel>
          </div>

           <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
    { label: "New business", value: data.kpis.newBusiness.toLocaleString(), detail: fmtKES(data.kpis.newBusinessPremium) },
    { label: "Revenue (paid)", value: fmtKES(data.kpis.revenue) },
    { label: "Active cover premium", value: fmtKES(data.kpis.activeCoverPremium) },
    { label: "Active policies", value: data.kpis.activePolicies.toLocaleString() },
    { label: "New clients", value: data.kpis.newClients.toLocaleString() },
    { label: "Open claims", value: data.kpis.openClaims.toLocaleString() },
    { label: "Renewal hit rate", value: `${Math.round(data.kpis.renewalHitRate * 100)}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {items.map((k) => (
        <Card key={k.label}><CardContent className="px-4 pb-4 pt-4 sm:pt-5">
          <div className="text-xs font-medium text-muted-foreground">{k.label}</div>
          <div className="mt-2 break-words text-xl font-bold tabular-nums sm:text-2xl">{k.value}</div>
          {k.detail && <div className="mt-1 truncate text-xs text-muted-foreground">{k.detail}</div>}
        </CardContent></Card>
      ))}
    </div>
  );
}

function Panel({ title, children, className = "", icon }: { title: string; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <Card className={className}>
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><CardTitle className="text-base">{title}</CardTitle>{icon}</CardHeader>
      <CardContent className="px-3 sm:px-6">{children}</CardContent>
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
          <div className="overflow-x-auto"><table className="min-w-[520px] w-full text-sm">
            <thead><tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">{head.map((h) => <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-b-0">{r.map((c, j) => <td key={j} className="px-4 py-2">{c}</td>)}</tr>)}</tbody>
          </table></div>
        )}
      </CardContent>
    </Card>
  );
}

function buildCsv(d: ReportsSummary, isAdmin: boolean): string {
  const lines: string[] = [];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  lines.push("Zest Insurance Agency — Report");
  lines.push(`Period,${d.range.from},${d.range.to}`);
  lines.push("");
  lines.push("KPI,Value");
  lines.push(`Revenue (paid),${d.kpis.revenue}`);
  lines.push(`Active cover premium,${d.kpis.activeCoverPremium}`);
  lines.push(`Active policies,${d.kpis.activePolicies}`);
  lines.push(`New clients,${d.kpis.newClients}`);
  lines.push(`Open claims,${d.kpis.openClaims}`);
  lines.push(`Renewal hit rate,${(d.kpis.renewalHitRate * 100).toFixed(1)}%`);
  lines.push(`New business policies,${d.kpis.newBusiness}`);
  lines.push(`New business premium,${d.kpis.newBusinessPremium}`);
  lines.push("");
  lines.push("Revenue by month,Amount");
  d.revenueOverTime.forEach((r) => lines.push(`${r.month},${r.revenue}`));
  lines.push("");
  lines.push("New business by month,Policies,Gross premium");
  d.newBusinessByMonth.forEach((r) => lines.push(`${r.month},${r.policies},${r.premium}`));
  lines.push("");
  lines.push("Insurer,Premium written");
  d.insurerShare.forEach((r) => lines.push(`${esc(r.insurer)},${r.premium}`));
  lines.push("");
  if (isAdmin) {
    lines.push("Branch,Policies,Premium,Claims");
    d.branchPerformance.forEach((b) => lines.push(`${esc(b.branch)},${b.policies},${b.premium},${b.claims}`));
  } else {
    lines.push("Branch,Policies,Claims");
    (d.branchPerformanceAll ?? []).forEach((b) => lines.push(`${esc(b.branch)},${b.policies},${b.claims}`));
  }
  lines.push("");
  lines.push("Agent,Policies,Premium");
  d.topAgents.forEach((a) => lines.push(`${esc(a.agent)},${a.policies},${a.premium}`));
  return lines.join("\n");
}