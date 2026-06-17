import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, ScrollText, BellRing } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: clientCount } = useQuery({
    queryKey: ["count", "clients"],
    queryFn: async () => {
      const { count } = await supabase.from("clients").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const tiles = [
    { label: "Clients", value: clientCount ?? "—", icon: Users, href: "/clients" },
    { label: "Active policies", value: "—", icon: FileText, href: "/policies" },
    { label: "Open claims", value: "—", icon: ScrollText, href: "/claims" },
    { label: "Due renewals", value: "—", icon: BellRing, href: "/renewals" },
  ];

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of agency activity across all branches." />
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