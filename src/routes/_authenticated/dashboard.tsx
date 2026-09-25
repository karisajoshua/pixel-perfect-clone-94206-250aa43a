import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, ScrollText, BellRing, DollarSign, Ban, AlertTriangle, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PageHeader } from "@/components/page-header";
import { getDashboardSummary } from "@/lib/dashboard.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { useMyRoles } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Agency dashboard — Zest Insurance" },
      { name: "description", content: "Agency performance, active covers, payments, renewals and new business at a glance." },
      { property: "og:title", content: "Agency dashboard — Zest Insurance" },
      { property: "og:description", content: "Agency performance, active covers, payments, renewals and new business at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (list.length > 0 && list.every((r) => r === "client")) {
      throw redirect({ to: "/portal" });
    }
  },
  component: Dashboard,
});

function Dashboard() {
  const fetchSummary = useServerFn(getDashboardSummary);
  const { data: roles } = useMyRoles();
  const isAdmin = roles?.includes("admin");
  const { data } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => fetchSummary(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

  const t = data?.totals;
  const tiles = [
    { label: "Clients", value: t?.clients ?? "—", icon: Users, href: "/clients" },
    { label: "Active policies (today)", value: t?.activePolicies ?? "—", icon: FileText, href: "/policies" },
    { label: "Open claims", value: t?.openClaims ?? "—", icon: ScrollText, href: "/claims" },
    { label: "Due renewals (30d)", value: t?.dueRenewals ?? "—", icon: BellRing, href: "/renewals" },
    { label: "Cancelled policies", value: t?.cancelledPolicies ?? "—", icon: Ban, href: "/policies" },
  ];

  const newBusinessChart = {
    policies: { label: "New policies", color: "var(--chart-1)" },
    premium: { label: "Gross premium", color: "var(--chart-3)" },
  } satisfies ChartConfig;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:space-y-8 lg:p-8">
      <PageHeader title="Dashboard" subtitle="Overview of agency activity across all branches." helpDocId="getting-started" />

      <OnboardingChecklist />

      {isAdmin && (
        <section aria-label="Revenue overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total collected (all time)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="break-words text-2xl font-bold tabular-nums sm:text-3xl">{t ? fmt(t.revenue) : "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t ? `${fmt(t.revenueThisMonth)} collected this month` : "Loading…"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active cover premium</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="break-words text-2xl font-bold tabular-nums sm:text-3xl">{t ? fmt(t.activeCoverPremium) : "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Gross premium on covers live today.</p>
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-label="Outstanding balances" className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding balances</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="break-words text-2xl font-bold tabular-nums sm:text-3xl">{t ? fmt(t.outstandingExtensions) : "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t ? `${t.overdueExtensions} overdue extension${t.overdueExtensions === 1 ? "" : "s"}` : "Loading…"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Agency statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {tiles.map((t) => (
          <Link to={t.href} key={t.label}>
            <Card className="group h-full hover:border-primary/40 focus-within:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
                <t.icon className="h-4 w-4 text-primary/70 transition-transform duration-200 group-hover:scale-110" />
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{t.value}</div>
                {t.label === "Cancelled policies" && data?.totals && (
                  <p className="text-xs text-muted-foreground mt-1">{data.totals.cancelledThisMonth} this month</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <CardTitle>New business</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">First-time policies issued over the last six months.</p>
          </div>
          <TrendingUp className="h-5 w-5 shrink-0 text-primary" />
        </CardHeader>
        <CardContent>
          {!data?.newBusinessByMonth?.some((item) => item.policies > 0) ? (
            <div className="grid h-48 place-items-center text-sm text-muted-foreground">No new business recorded yet.</div>
          ) : (
            <ChartContainer config={newBusinessChart} className="h-56 w-full sm:h-72" aria-label="New policies by month">
              <AreaChart data={data.newBusinessByMonth} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 5" opacity={0.4} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={formatMonth} minTickGap={18} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatMonth(String(value))} />} />
                <Area type="monotone" dataKey="policies" stroke="var(--color-policies)" fill="var(--color-policies)" fillOpacity={0.12} strokeWidth={2.5} isAnimationActive animationDuration={650} animationEasing="ease-out" />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent cancellations</CardTitle></CardHeader>
        <CardContent>
          {!data?.recentCancellations?.length ? (
            <p className="text-sm text-muted-foreground">No cancelled policies.</p>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {data.recentCancellations.map((r) => (
                <div key={r.id} className="rounded-md border p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                    <div className="min-w-0"><Link to="/policies/$id" params={{ id: r.id }} className="font-mono text-sm font-semibold text-primary">{r.policy_no}</Link><p className="truncate text-sm">{r.client_name}</p></div>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.cancelled_at ? new Date(r.cancelled_at).toLocaleDateString() : "—"}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{r.cancellation_reason ?? "No reason provided"}</p>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Cancelled</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentCancellations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">
                      <Link to="/policies/$id" params={{ id: r.id }} className="hover:underline">{r.policy_no}</Link>
                    </TableCell>
                    <TableCell>{r.client_name}</TableCell>
                    <TableCell>{r.cancelled_at ? new Date(r.cancelled_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="max-w-md truncate" title={r.cancellation_reason ?? ""}>{r.cancellation_reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
            </>
          )}
        </CardContent>
      </Card>

      {data?.overdueExtensionsList && data.overdueExtensionsList.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Overdue payment extensions</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdueExtensionsList.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono">
                      <Link to="/policies/$id" params={{ id: e.policy_id }} className="hover:underline">{e.policy_no}</Link>
                    </TableCell>
                    <TableCell>{e.client_name}</TableCell>
                    <TableCell>{e.due_date}</TableCell>
                    <TableCell className="text-right">{fmt(e.amount_due)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>Revenue by branch</CardTitle></CardHeader>
          <CardContent>
            {!data?.byBranch?.length ? (
              <p className="text-sm text-muted-foreground">No revenue recorded yet.</p>
            ) : (
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Clients</TableHead>
                    <TableHead className="text-right">Policies</TableHead>
                    <TableHead className="text-right">Active cover</TableHead>
                    <TableHead className="text-right">Revenue (paid)</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byBranch.map((b) => (
                    <TableRow key={b.branchId ?? "unassigned"}>
                      <TableCell className="font-medium">{b.branchName}</TableCell>
                      <TableCell className="text-right">{b.clients}</TableCell>
                      <TableCell className="text-right">{b.policies}</TableCell>
                      <TableCell className="text-right">{fmt(b.activeCoverPremium)}</TableCell>
                      <TableCell className="text-right">{fmt(b.revenue)}</TableCell>
                      <TableCell className="text-right">{(b.share * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell>All branches</TableCell>
                    <TableCell className="text-right">
                      {data.byBranch.reduce((s, b) => s + b.clients, 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.byBranch.reduce((s, b) => s + b.policies, 0)}
                    </TableCell>
                    <TableCell className="text-right">{fmt(t?.activeCoverPremium ?? 0)}</TableCell>
                    <TableCell className="text-right">{fmt(t?.revenue ?? 0)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Getting started</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Set up your branches in <Link to="/admin/branches" className="text-primary underline">Admin → Branches</Link>.</p>
          <p>2. Invite staff and assign roles in <Link to="/admin/users" className="text-primary underline">Admin → Users</Link>.</p>
          <p>3. Start adding <Link to="/clients" className="text-primary underline">clients</Link> and uploading their KYC documents.</p>
          <p>4. Other modules — vehicles, policies, quotations, invoices, claims, renewals and reports — are being rolled out in the next phases.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en-KE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}