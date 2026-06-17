import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyPolicy } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/policies/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const fn = useServerFn(getMyPolicy);
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-policy", id], queryFn: () => fn({ data: { id } }), staleTime: 60_000 });
  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-destructive">{(error as Error).message}</div>;
  if (!data) return null;
  const p: any = data.policy;
  return (
    <div className="max-w-5xl space-y-6">
      <Link to="/portal/policies" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> All policies</Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{p.policy_no}</h1>
          <div className="text-muted-foreground text-sm">{p.insurers?.name} · {p.product_class} · {p.cover_type}</div>
        </div>
        <div className="flex gap-2">
          <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
          {p.document_url && (
            <Button asChild size="sm" variant="outline">
              <a href={p.document_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-1" /> Policy PDF</a>
            </Button>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-base">Coverage</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
          <Row k="Period" v={`${p.start_date} → ${p.end_date}`} />
          <Row k="Sum insured" v={p.sum_insured ? Number(p.sum_insured).toLocaleString() : "—"} />
          <Row k="Gross premium" v={p.premium_gross ? Number(p.premium_gross).toLocaleString() : "—"} />
          <Row k="Payment" v={p.payment_status} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Vehicle</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
          {p.vehicles ? <>
            <Row k="Registration" v={p.vehicles.registration_no} />
            <Row k="Make/Model" v={`${p.vehicles.make ?? ""} ${p.vehicles.model ?? ""}`.trim() || "—"} />
            <Row k="Year" v={String(p.vehicles.year ?? "—")} />
            <Row k="Chassis" v={p.vehicles.chassis_no ?? "—"} />
          </> : <div className="text-muted-foreground">No vehicle linked.</div>}
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Invoices for this policy</CardTitle></CardHeader><CardContent>
        {data.invoices.length === 0 ? (
          <div className="text-sm text-muted-foreground">No invoices.</div>
        ) : (
          <ul className="divide-y text-sm">
            {data.invoices.map((i: any) => (
              <li key={i.id} className="py-2 flex items-center justify-between">
                <Link to="/portal/invoices/$id" params={{ id: i.id }} className="text-primary font-medium">{i.invoice_no}</Link>
                <div className="text-muted-foreground">{i.issue_date} · {Number(i.total).toLocaleString()} <Badge variant="secondary" className="ml-2">{i.status}</Badge></div>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}