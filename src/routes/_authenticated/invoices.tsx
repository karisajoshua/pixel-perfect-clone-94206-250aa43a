import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Plus, Download } from "lucide-react";
import { InvoiceFormDialog } from "@/components/invoices/invoice-form-dialog";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices")({ component: InvoicesLayout });

function InvoicesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/invoices") return <Outlet />;
  return <InvoicesList />;
}

function InvoicesList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>("all");

  const { data } = useQuery({
    queryKey: ["invoices", status],
    queryFn: async () => {
      let q = supabase.from("invoices")
        .select("id, invoice_no, status, issue_date, due_date, total, amount_paid, client_id, clients(full_name, company_name, client_type)")
        .order("issue_date", { ascending: false }).limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error; return data;
    },
  });

  const handleDownload = async (invoiceId: string) => {
    const { data, error } = await supabase.from("invoices")
      .select("*, clients(id, full_name, company_name, client_type, email, phone), policies(policy_no), invoice_items(*), payments(*), branches(name, address, phone, email)")
      .eq("id", invoiceId).single();
    if (error || !data) return toast.error(error?.message ?? "Failed to load invoice");
    const inv: any = data;
    downloadInvoicePdf({ invoice: inv, client: inv.clients, branch: inv.branches, policyNo: inv.policies?.policy_no, items: inv.invoice_items, payments: inv.payments });
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Invoices" subtitle="Premium and fee billing."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New invoice</Button>} />
      <div className="flex gap-1 flex-wrap">
        {["all","draft","sent","partial","paid","overdue","void"].map(s => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>{s}</Button>
        ))}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">No invoices yet.</td></tr>}
              {data?.map((i: any) => {
                const cl = i.clients; const name = cl ? (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) : "—";
                const balance = Number(i.total) - Number(i.amount_paid);
                return (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">{i.invoice_no}</td>
                    <td className="px-4 py-3">{name}</td>
                    <td className="px-4 py-3">{i.issue_date}</td>
                    <td className="px-4 py-3">{i.due_date}</td>
                    <td className="px-4 py-3">KES {Number(i.total).toLocaleString()}</td>
                    <td className={`px-4 py-3 ${balance > 0 ? "text-destructive font-medium" : ""}`}>KES {balance.toLocaleString()}</td>
                    <td className="px-4 py-3"><Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(i.id)}><Download className="h-4 w-4 mr-1" /> PDF</Button>
                      <Button asChild size="sm" variant="ghost"><Link to="/invoices/$id" params={{ id: i.id }}>Open</Link></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <InvoiceFormDialog open={open} onOpenChange={setOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["invoices"] })} />
    </div>
  );
}