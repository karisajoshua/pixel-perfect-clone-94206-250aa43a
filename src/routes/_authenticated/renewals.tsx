import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { parseLocalDate } from "@/lib/date-only";

export const Route = createFileRoute("/_authenticated/renewals")({ component: RenewalsPage });

function RenewalsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["renewals"],
    queryFn: async () => {
      const today = new Date();
      const in60 = new Date(); in60.setDate(today.getDate() + 60);
      const cutoff = `${in60.getFullYear()}-${String(in60.getMonth() + 1).padStart(2, "0")}-${String(in60.getDate()).padStart(2, "0")}`;
      const [candidateResult, linkResult] = await Promise.all([
        supabase
          .from("policies")
          .select("id, policy_no, end_date, status, premium_gross, client_id, vehicle_id, product_class, previous_policy_id, clients(full_name, company_name, client_type), insurers(name), vehicles(registration_no)")
          .in("status", ["active", "pending", "expired"])
          .lte("end_date", cutoff)
          .order("end_date", { ascending: true })
          .limit(5000),
        supabase
          .from("policies")
          .select("previous_policy_id")
          .in("status", ["active", "pending", "expired", "renewed"])
          .not("previous_policy_id", "is", null)
          .limit(5000),
      ]);
      if (candidateResult.error) throw candidateResult.error;
      if (linkResult.error) throw linkResult.error;

      // A policy is superseded only when another policy explicitly links to it.
      // Do not group by vehicle or client/class: clients can legitimately hold
      // multiple independent covers for the same vehicle or non-motor class.
      const rows = (candidateResult.data ?? []).filter((p: any) => {
        const d = parseLocalDate(p.end_date);
        return !!d && d.getFullYear() > 1900;
      });
      const superseded = new Set<string>();
      for (const p of linkResult.data ?? []) {
        if (p.previous_policy_id) superseded.add(p.previous_policy_id);
      }
      return rows
        .filter((p: any) => !superseded.has(p.id))
        .sort((a, b) => String(a.end_date).localeCompare(String(b.end_date)));
    },
  });

  const today = new Date();
  const buckets = {
    overdue: [] as any[],
    in7: [] as any[],
    in30: [] as any[],
    later: [] as any[],
  };
  const q = search.trim().toLowerCase();
  const clientLabel = (p: any) => {
    const cl = p.clients;
    if (!cl) return "";
    return (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) ?? "";
  };
  const rows = (data ?? []).filter((p: any) => {
    if (!q) return true;
    return [clientLabel(p), p.policy_no, p.vehicles?.registration_no]
      .filter(Boolean)
      .some((v: string) => String(v).toLowerCase().includes(q));
  });
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (const p of rows) {
    const end = parseLocalDate(p.end_date)!;
    const days = Math.round((end.getTime() - startOfToday.getTime()) / 86400000);
    if (days < 0) buckets.overdue.push({ ...p, days });
    else if (days <= 7) buckets.in7.push({ ...p, days });
    else if (days <= 30) buckets.in30.push({ ...p, days });
    else buckets.later.push({ ...p, days });
  }


  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Renewals" subtitle="Policies due in the next 60 days, grouped by urgency." />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by client name, policy no. or registration…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      <Bucket title="Overdue" tone="destructive" rows={buckets.overdue} />
      <Bucket title="Due in 7 days" tone="warning" rows={buckets.in7} />
      <Bucket title="Due in 30 days" tone="default" rows={buckets.in30} />
      <Bucket title="31–60 days" tone="muted" rows={buckets.later} />
      {!isLoading && q && rows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No renewals match “{search}”.</CardContent>
        </Card>
      )}
      {!isLoading && !q && (data?.length ?? 0) === 0 && (
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