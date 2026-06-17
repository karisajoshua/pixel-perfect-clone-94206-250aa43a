import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPortalOverview } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Receipt, ScrollText, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/")({
  component: Page,
});

const KES = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

function Page() {
  const fn = useServerFn(getPortalOverview);
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-overview"], queryFn: () => fn(), staleTime: 60_000 });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-destructive">{(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Hello, {data.client.full_name.split(" ")[0]}</h1>
        <p className="text-muted-foreground text-sm">Your insurance at a glance.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={FileText} label="Active policies" value={String(data.kpis.activePolicies)} />
        <Kpi icon={CalendarClock} label="Next renewal" value={data.kpis.nextRenewal ? new Date(data.kpis.nextRenewal.end_date).toLocaleDateString() : "—"} sub={data.kpis.nextRenewal?.policy_no} />
        <Kpi icon={Receipt} label="Outstanding balance" value={KES.format(data.kpis.outstanding)} tone={data.kpis.outstanding > 0 ? "warn" : "ok"} />
        <Kpi icon={ScrollText} label="Open claims" value={String(data.kpis.openClaims)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent claims</CardTitle></CardHeader>
        <CardContent>
          {data.recentClaims.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No claims reported yet. <Link to="/portal/claims" className="text-primary underline">Report one</Link>.</div>
          ) : (
            <ul className="divide-y">
              {data.recentClaims.map((c: any) => (
                <li key={c.id} className="py-3 flex items-center justify-between text-sm">
                  <div><span className="font-medium">{c.claim_no}</span><span className="text-muted-foreground"> · {c.incident_date ?? "—"}</span></div>
                  <Badge variant="secondary">{c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <Icon className={`h-4 w-4 ${tone === "warn" ? "text-amber-600" : "text-muted-foreground"}`} />
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}