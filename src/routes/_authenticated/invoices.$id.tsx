import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Pencil, Plus, Download, Trash2, User } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMyRoles } from "@/hooks/use-auth";
import { deleteInvoiceCascade } from "@/lib/invoice-delete";
import { syncPolicyFromInvoice } from "@/lib/policy-payment-sync";
import { PageHeader } from "@/components/page-header";
import { InvoiceFormDialog } from "@/components/invoices/invoice-form-dialog";
import { toast } from "sonner";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";

export const Route = createFileRoute("/_authenticated/invoices/$id")({ beforeLoad: requireRole(["admin", "manager", "agent"]), component: InvoiceDetail });

function InvoiceDetail() {
  const { id } = useParams({ from: "/_authenticated/invoices/$id" });
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePayment, setDeletePayment] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { data: roles } = useMyRoles();
  const canDelete = !!roles?.some((r) => r === "admin" || r === "manager");

  const { data: inv } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("*, clients(id, full_name, company_name, client_type, email, phone), policies(id, policy_no), invoice_items(*), payments(*), branches(name, address, phone, email)")
        .eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  if (!inv) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const cl = inv.clients;
  const name = cl?.client_type === "corporate" ? cl?.company_name ?? cl?.full_name : cl?.full_name;
  const balance = Number(inv.total) - Number(inv.amount_paid);

  return (
    <div className="p-8 space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/invoices"><ArrowLeft className="h-4 w-4 mr-1" /> All invoices</Link></Button>
      <PageHeader title={inv.invoice_no} subtitle={`${name} • Due ${inv.due_date}`}
        actions={
          <div className="flex gap-2">
            {cl?.id && (
              <Button asChild variant="outline">
                <Link to="/clients/$id" params={{ id: cl.id }}><User className="h-4 w-4 mr-1" /> Open client</Link>
              </Button>
            )}
            <Button variant="outline" onClick={async () => {
              const t = toast.loading("Preparing PDF…");
              try {
                await downloadInvoicePdf({ invoice: inv, client: inv.clients, branch: inv.branches, policyNo: inv.policies?.policy_no, items: inv.invoice_items, payments: inv.payments });
                toast.success("Invoice downloaded", { id: t });
              } catch (e: any) {
                console.error("Invoice download failed", e);
                toast.error(e?.message ?? "Download failed", { id: t });
              }
            }}><Download className="h-4 w-4 mr-1" /> Download PDF</Button>
            <Button variant="outline" onClick={() => setPay(true)}><Plus className="h-4 w-4 mr-1" /> Record payment</Button>
            <Button onClick={() => setEdit(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
            {canDelete && (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
            )}
          </div>
        } />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr><th className="px-4 py-2">Description</th><th className="px-4 py-2 w-20">Qty</th><th className="px-4 py-2 w-28">Unit</th><th className="px-4 py-2 w-28 text-right">Total</th></tr>
              </thead>
              <tbody>
                {inv.invoice_items?.map((it: any) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{it.description}</td>
                    <td className="px-4 py-2">{it.quantity}</td>
                    <td className="px-4 py-2">{Number(it.unit_price).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{Number(it.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 space-y-1 text-sm border-t">
              <div className="flex justify-between"><span>Subtotal</span><span>KES {Number(inv.subtotal).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>KES {Number(inv.tax).toLocaleString()}</span></div>
              <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Total</span><span>KES {Number(inv.total).toLocaleString()}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>KES {Number(inv.amount_paid).toLocaleString()}</span></div>
              <div className={`flex justify-between font-semibold ${balance > 0 ? "text-destructive" : "text-emerald-700"}`}><span>Balance</span><span>KES {balance.toLocaleString()}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <PaymentStatement
              payments={inv.payments ?? []}
              total={Number(inv.total ?? 0)}
              renderActions={(p: any) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={async () => {
                    const t = toast.loading("Preparing receipt…");
                    try {
                      await downloadReceiptPdf({ payment: p, invoice: inv, client: inv.clients, branch: inv.branches, policyNo: inv.policies?.policy_no, allPayments: inv.payments });
                      toast.success("Receipt downloaded", { id: t });
                    } catch (e: any) {
                      toast.error(e?.message ?? "Download failed", { id: t });
                    }
                  }}><Download className="h-3.5 w-3.5 mr-1" /> Receipt</Button>
                  {canDelete && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => setDeletePayment(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            />
          </CardContent>
        </Card>

      </div>

      <InvoiceFormDialog open={edit} onOpenChange={setEdit} initial={{ ...inv, items: inv.invoice_items }} onSaved={() => qc.invalidateQueries({ queryKey: ["invoice", id] })} />
      <PaymentDialog open={pay} onOpenChange={setPay} invoiceId={id} max={balance} currentPaid={Number(inv.amount_paid)} total={Number(inv.total)} policyId={inv.policy_id} onSaved={() => { qc.invalidateQueries({ queryKey: ["invoice", id] }); qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />
      <AlertDialog open={!!deletePayment} onOpenChange={(o) => { if (!o) setDeletePayment(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the payment of KES {Number(deletePayment?.amount ?? 0).toLocaleString()} recorded on {deletePayment?.paid_date}.
              The invoice balance and the policy payment status are recalculated. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={async (e) => {
              e.preventDefault();
              setDeleting(true);
              try {
                const paymentId = deletePayment.id;
                const { error } = await supabase.from("payments").delete().eq("id", paymentId);
                if (error) throw new Error(error.message);
                const remaining = (inv.payments ?? []).filter((x: any) => x.id !== paymentId);
                const newPaid = remaining.reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0);
                const total = Number(inv.total ?? 0);
                const newStatus = newPaid <= 0 ? "unpaid" : newPaid >= total - 0.01 ? "paid" : "partial";
                await supabase.from("invoices").update({ amount_paid: newPaid, status: newStatus }).eq("id", id);
                await syncPolicyFromInvoice(inv.policy_id);
                toast.success("Receipt deleted");
                setDeletePayment(null);
                qc.invalidateQueries({ queryKey: ["invoice", id] });
                qc.invalidateQueries({ queryKey: ["invoices"] });
                qc.invalidateQueries({ queryKey: ["dashboard"] });
              } catch (err: any) {
                toast.error(err?.message ?? "Delete failed");
              } finally {
                setDeleting(false);
              }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {inv.invoice_no}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the invoice along with its line items and any payments recorded against it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={async (e) => {
              e.preventDefault();
              setDeleting(true);
              try {
                await deleteInvoiceCascade(id);
                toast.success("Invoice deleted");
                qc.invalidateQueries({ queryKey: ["invoices"] });
                navigate({ to: "/invoices" });
              } catch (err: any) {
                toast.error(err?.message ?? "Delete failed");
              } finally {
                setDeleting(false);
              }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PaymentDialog({ open, onOpenChange, invoiceId, max, currentPaid, total, policyId, onSaved }: any) {
  const [amount, setAmount] = useState<number>(max);
  const [method, setMethod] = useState("mpesa");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));

  const submit = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data: pay, error } = await supabase.from("payments").insert({ invoice_id: invoiceId, amount, method, reference, paid_date: date, recorded_by: u.user?.id } as any).select("id").single();
    if (error) return toast.error(error.message);
    const newPaid = currentPaid + amount;
    const newStatus = newPaid >= total ? "paid" : "partial";
    await supabase.from("invoices").update({ amount_paid: newPaid, status: newStatus }).eq("id", invoiceId);
    try { await syncPolicyFromInvoice(policyId); } catch {}
    toast.success("Payment recorded");
    try {
      const { data: inv } = await supabase.from("invoices").select("invoice_no, client_id, clients(email, full_name, company_name, client_type)").eq("id", invoiceId).maybeSingle();
      const c: any = (inv as any)?.clients;
      if (c?.email && pay?.id) {
        const { sendTransactionalEmail, clientDisplayName, formatKES } = await import("@/lib/email/send");
        sendTransactionalEmail({
          templateName: "payment-receipt",
          recipientEmail: c.email,
          idempotencyKey: `payment-receipt-${pay.id}`,
          templateData: {
            clientName: clientDisplayName(c),
            invoiceNo: (inv as any)?.invoice_no ?? '',
            amount: formatKES(amount),
            paidAt: date,
            method,
            reference,
          },
        });
      }
    } catch {}
    onSaved?.(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Amount (KES)</Label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction code" /></div>
          <div className="space-y-1.5"><Label>Paid date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!amount || amount <= 0}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}