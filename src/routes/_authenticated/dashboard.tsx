import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, ScrollText, BellRing, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getDashboardSummary } from "@/lib/dashboard.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

export const Route = createFileRoute("/_authenticated/dashboard")({
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
  const { data } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => fetchSummary(),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

  const t = data?.totals;
  const tiles = [
    { label: "Clients", value: t?.clients ?? "—", icon: Users, href: "/clients" },
    { label: "Active policies", value: t?.activePolicies ?? "—", icon: FileText, href: "/policies" },
    { label: "Open claims", value: t?.openClaims ?? "—", icon: ScrollText, href: "/claims" },
    { label: "Due renewals (30d)", value: t?.dueRenewals ?? "—", icon: BellRing, href: "/renewals" },
  ];

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of agency activity across all branches." helpDocId="getting-started" />

      <OnboardingChecklist />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{t ? fmt(t.revenue) : "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t ? `${fmt(t.revenueThisMonth)} this month` : "Loading…"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link to={t.href} key={t.label}>
            <Card className="hover:border-primary transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
                <t.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{t.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue by branch</CardTitle></CardHeader>
        <CardContent>
          {!data?.byBranch?.length ? (
            <p className="text-sm text-muted-foreground">No revenue recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Policies</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byBranch.map((b) => (
                  <TableRow key={b.branchId ?? "unassigned"}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    <TableCell className="text-right">{b.policies}</TableCell>
                    <TableCell className="text-right">{fmt(b.revenue)}</TableCell>
                    <TableCell className="text-right">{(b.share * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold border-t-2">
                  <TableCell>All branches</TableCell>
                  <TableCell className="text-right">
                    {data.byBranch.reduce((s, b) => s + b.policies, 0)}
                  </TableCell>
                  <TableCell className="text-right">{fmt(t?.revenue ?? 0)}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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