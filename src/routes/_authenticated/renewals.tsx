import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/renewals")({ component: RenewalsPage });

function RenewalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["renewals"],
    queryFn: async () => {
      const today = new Date();
      const in60 = new Date(); in60.setDate(today.getDate() + 60);
      const { data, error } = await supabase
        .from("policies")
        .select("id, policy_no, end_date, status, premium_gross, client_id, clients(full_name, company_name, client_type), insurers(name), vehicles(registration_no)")
        .lte("end_date", in60.toISOString().slice(0, 10))
        .in("status", ["active", "pending", "expired"])
        .order("end_date", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const today = new Date();
  const buckets = {
    overdue: [] as any[],
    in7: [] as any[],
    in30: [] as any[],
    later: [] as any[],
  };
  for (const p of data ?? []) {
    const end = new Date(p.end_date);
    const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    if (days < 0) buckets.overdue.push({ ...p, days });
    else if (days <= 7) buckets.in7.push({ ...p, days });
    else if (days <= 30) buckets.in30.push({ ...p, days });
    else buckets.later.push({ ...p, days });
  }

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Renewals" subtitle="Policies due in the next 60 days, grouped by urgency." />
      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      <Bucket title="Overdue" tone="destructive" rows={buckets.overdue} />
      <Bucket title="Due in 7 days" tone="warning" rows={buckets.in7} />
      <Bucket title="Due in 30 days" tone="default" rows={buckets.in30} />
      <Bucket title="31–60 days" tone="muted" rows={buckets.later} />
      {!isLoading && (data?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-16 text-center space-y-2">
            <div className="text-lg font-semibold">No upcoming renewals</div>
            <p className="text-sm text-muted-foreground">
              Nothing is due in the next 60 days. New policies will appear here automatically as their end date approaches.
            </p>
            <div className="pt-2">
              <Button asChild size="sm" variant="outline"><Link to="/policies">Go to policies</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Bucket({ title, tone, rows }: { title: string; tone: "destructive" | "warning" | "default" | "muted"; rows: any[] }) {
  if (rows.length === 0) return null;
  const dot = { destructive: "bg-destructive", warning: "bg-amber-500", default: "bg-primary", muted: "bg-muted-foreground" }[tone];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant="secondary" className="ml-auto">{rows.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((p) => {
              const cl = p.clients;
              const name = cl ? (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) : "—";
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3 font-mono">{p.policy_no}</td>
                  <td className="px-4 py-3">{name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.vehicles?.registration_no ?? "—"}</td>
                  <td className="px-4 py-3">{p.insurers?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div>{p.end_date}</div>
                    <div className="text-xs text-muted-foreground">{p.days < 0 ? `${Math.abs(p.days)} days overdue` : `in ${p.days} days`}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline"><Link to="/policies/$id" params={{ id: p.id }}>Open</Link></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}