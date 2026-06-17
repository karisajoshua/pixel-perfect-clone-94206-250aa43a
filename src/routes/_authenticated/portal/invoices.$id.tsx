import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyInvoice } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/invoices/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const fn = useServerFn(getMyInvoice);
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-invoice", id], queryFn: () => fn({ data: { id } }), staleTime: 60_000 });
  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-destructive">{(error as Error).message}</div>;
  if (!data) return null;
  const inv: any = data;
  const bal = Number(inv.total) - Number(inv.amount_paid || 0);
  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/portal/invoices" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> All invoices</Link>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{inv.invoice_no}</h1>
          <div className="text-sm text-muted-foreground">Issued {inv.issue_date} · Due {inv.due_date}{inv.policies?.policy_no ? ` · Policy ${inv.policies.policy_no}` : ""}</div>
        </div>
        <Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Line items</CardTitle></CardHeader><CardContent>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground"><tr><th className="text-left py-2">Description</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {(inv.invoice_items ?? []).map((it: any) => (
              <tr key={it.id} className="border-t"><td className="py-2">{it.description}</td><td className="text-right">{Number(it.quantity)}</td><td className="text-right">{Number(it.unit_price).toLocaleString()}</td><td className="text-right">{Number(it.total).toLocaleString()}</td></tr>
            ))}
          </tbody>
          <tfoot className="border-t font-medium">
            <tr><td colSpan={3} className="py-2 text-right">Subtotal</td><td className="text-right">{Number(inv.subtotal).toLocaleString()}</td></tr>
            <tr><td colSpan={3} className="py-1 text-right">Tax</td><td className="text-right">{Number(inv.tax).toLocaleString()}</td></tr>
            <tr><td colSpan={3} className="py-1 text-right">Total</td><td className="text-right">{Number(inv.total).toLocaleString()}</td></tr>
            <tr><td colSpan={3} className="py-1 text-right">Paid</td><td className="text-right">{Number(inv.amount_paid).toLocaleString()}</td></tr>
            <tr><td colSpan={3} className="py-1 text-right">Balance</td><td className={`text-right ${bal > 0 ? "text-amber-600" : ""}`}>{bal.toLocaleString()}</td></tr>
          </tfoot>
        </table>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader><CardContent>
        {(inv.payments ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No payments recorded.</div> :
        <ul className="divide-y text-sm">{inv.payments.map((p: any) => (
          <li key={p.id} className="py-2 flex justify-between"><span>{p.paid_date} · {p.method ?? "—"} {p.reference ? `(${p.reference})` : ""}</span><span className="font-medium">{Number(p.amount).toLocaleString()}</span></li>
        ))}</ul>}
      </CardContent></Card>
    </div>
  );
}