import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPortalOverview } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Receipt, ScrollText, CalendarClock, ChevronRight, ShieldPlus, Upload, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_portal/portal/")({
  component: Page,
});

const KES = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

function Page() {
  const fn = useServerFn(getPortalOverview);
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-overview"], queryFn: () => fn(), staleTime: 60_000 });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-destructive">{(error as Error).message}</div>;
  if (!data) return null;

  const today = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="space-y-5 md:space-y-6 max-w-6xl">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{today}</p>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">Hello, {data.client.full_name.split(" ")[0]}</h1>
        <p className="text-muted-foreground text-sm">Your insurance at a glance.</p>
      </div>

      {/* Quick actions — thumb-reach */}
      <div className="grid grid-cols-3 gap-3 md:hidden">
        <QuickAction to="/portal/claims" icon={ShieldPlus} label="Report claim" />
        <QuickAction to="/portal/invoices" icon={CreditCard} label="Pay invoice" />
        <QuickAction to="/portal/documents" icon={Upload} label="Documents" />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={FileText} label="Active policies" value={String(data.kpis.activePolicies)} />
        <Kpi icon={CalendarClock} label="Next renewal" value={data.kpis.nextRenewal ? new Date(data.kpis.nextRenewal.end_date).toLocaleDateString() : "—"} sub={data.kpis.nextRenewal?.policy_no} />
        <Kpi icon={Receipt} label="Outstanding balance" value={KES.format(data.kpis.outstanding)} tone={data.kpis.outstanding > 0 ? "warn" : "ok"} />
        <Kpi icon={ScrollText} label="Open claims" value={String(data.kpis.openClaims)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent claims</CardTitle></CardHeader>
        <CardContent className="px-2 md:px-6">
          {data.recentClaims.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No claims reported yet. <Link to="/portal/claims" className="text-primary underline">Report one</Link>.</div>
          ) : (
            <ul className="divide-y">
              {data.recentClaims.map((c: any) => (
                <li key={c.id}>
                  <Link
                    to="/portal/claims"
                    className="py-3 px-2 md:px-0 flex items-center justify-between gap-3 text-sm hover:bg-muted/40 rounded-md transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.claim_no}</div>
                      <div className="text-xs text-muted-foreground">{c.incident_date ?? "—"}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">{c.status}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
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
    <Card className="overflow-hidden">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground truncate pr-2">{label}</div>
          <Icon className={`h-4 w-4 shrink-0 ${tone === "warn" ? "text-amber-600" : "text-muted-foreground"}`} />
        </div>
        <div className="mt-2 text-xl md:text-2xl font-semibold truncate">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-card border border-border py-4 px-2 text-center hover:bg-muted/50 transition-colors active:scale-[0.98]"
    >
      <span className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </Link>
  );
}