import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { PaymentStatement } from "@/components/payments/payment-statement";
import { formatKES } from "@/lib/policy-balance";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { toast } from "sonner";

export function ClientBilling({ clientId }: { clientId: string }) {
  const [openRow, setOpenRow] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["client-billing", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_no, issue_date, due_date, total, amount_paid, status, policy_id, policies(policy_no), clients(id, full_name, company_name, client_type, email, phone), branches(name, address, phone, email), payments(id, invoice_id, amount, method, reference, paid_date, created_at)")
        .eq("client_id", clientId)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading billing…</div>;

  const invoices = data ?? [];
  const billed = invoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const paid = invoices.reduce((s, i) => s + (i.payments ?? []).reduce((t: number, p: any) => t + Number(p.amount ?? 0), 0), 0);
  const outstanding = Math.max(0, Math.round((billed - paid) * 100) / 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Summary label="Total billed" value={formatKES(billed)} />
        <Summary label="Total paid" value={formatKES(paid)} />
        <Summary label="Outstanding" value={formatKES(outstanding)} tone={outstanding > 0 ? "bad" : "good"} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Invoices &amp; payments</CardTitle></CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No invoices raised for this client yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2 w-8"></th>
                    <th className="px-4 py-2 font-medium">Invoice</th>
                    <th className="px-4 py-2 font-medium">Cover</th>
                    <th className="px-4 py-2 font-medium">Issued</th>
                    <th className="px-4 py-2 font-medium text-right">Total</th>
                    <th className="px-4 py-2 font-medium text-right">Paid</th>
                    <th className="px-4 py-2 font-medium text-right">Balance</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i: any) => {
                    const payments = i.payments ?? [];
                    const invPaid = payments.reduce((t: number, p: any) => t + Number(p.amount ?? 0), 0);
                    const bal = Math.max(0, Math.round((Number(i.total ?? 0) - invPaid) * 100) / 100);
                    const expanded = openRow === i.id;
                    return (
                      <>
                        <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-2 py-2">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setOpenRow(expanded ? null : i.id)}>
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </td>
                          <td className="px-4 py-2 font-mono font-medium">{i.invoice_no}</td>
                          <td className="px-4 py-2 font-mono text-xs">{i.policies?.policy_no ?? "—"}</td>
                          <td className="px-4 py-2">{i.issue_date}</td>
                          <td className="px-4 py-2 text-right">{Number(i.total).toLocaleString()}</td>
                          <td className="px-4 py-2 text-right">{invPaid.toLocaleString()}</td>
                          <td className={`px-4 py-2 text-right ${bal > 0 ? "text-destructive font-medium" : ""}`}>{bal.toLocaleString()}</td>
                          <td className="px-4 py-2"><Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge></td>
                          <td className="px-4 py-2 text-right">
                            <Button asChild size="sm" variant="ghost"><Link to="/invoices/$id" params={{ id: i.id }}>Open</Link></Button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${i.id}-detail`} className="border-b bg-muted/20">
                            <td></td>
                            <td colSpan={8} className="px-4 py-3">
                              <PaymentStatement
                                payments={payments}
                                total={Number(i.total ?? 0)}
                                emptyText="No payments recorded against this invoice yet."
                                renderActions={(p: any) => (
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={async () => {
                                    const t = toast.loading("Preparing receipt…");
                                    try {
                                      await downloadReceiptPdf({ payment: p, invoice: i, client: i.clients, branch: i.branches, policyNo: i.policies?.policy_no, allPayments: payments });
                                      toast.success("Receipt downloaded", { id: t });
                                    } catch (e: any) {
                                      toast.error(e?.message ?? "Download failed", { id: t });
                                    }
                                  }}><Download className="h-3.5 w-3.5 mr-1" /> Receipt</Button>
                                )}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`mt-1 text-lg font-semibold ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-emerald-700" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
