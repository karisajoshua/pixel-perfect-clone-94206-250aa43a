import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sendTransactionalEmail, clientDisplayName, formatKES } from "@/lib/email/send";

type Item = { description: string; quantity: number; unit_price: number };

export function InvoiceFormDialog({ open, onOpenChange, onSaved, initial }: any) {
  const [form, setForm] = useState<any>({});
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [clients, setClients] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    const today = new Date(); const due = new Date(); due.setDate(today.getDate() + 14);
    setForm(initial ?? {
      invoice_no: `INV-${Date.now()}`, status: "draft",
      issue_date: today.toISOString().slice(0,10), due_date: due.toISOString().slice(0,10),
      tax: 0,
    });
    setItems(initial?.items?.length ? initial.items : [{ description: "", quantity: 1, unit_price: 0 }]);
    supabase.from("clients").select("id, full_name, company_name, client_type").order("full_name").then(({ data }) => setClients(data ?? []));
    supabase.from("policies").select("id, policy_no, client_id").order("policy_no").then(({ data }) => setPolicies(data ?? []));
  }, [open, initial]);

  const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const tax = Number(form.tax || 0);
  const total = subtotal + tax;

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, subtotal, total, created_by: u.user?.id };
    let invoiceId = initial?.id;
    if (invoiceId) {
      const { error } = await supabase.from("invoices").update(payload).eq("id", invoiceId);
      if (error) { setSaving(false); return toast.error(error.message); }
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
    } else {
      const { data, error } = await supabase.from("invoices").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Insert failed"); }
      invoiceId = data.id;
    }
    const itemRows = items.filter(i => i.description).map(i => ({
      invoice_id: invoiceId, description: i.description, quantity: i.quantity,
      unit_price: i.unit_price, total: Number(i.quantity) * Number(i.unit_price),
    }));
    if (itemRows.length) await supabase.from("invoice_items").insert(itemRows);
    setSaving(false);
    toast.success("Invoice saved");
    if (!initial?.id && invoiceId && form.client_id) {
      supabase.from("clients").select("email, full_name, company_name, client_type").eq("id", form.client_id).maybeSingle().then(({ data: c }) => {
        if (!c?.email) return;
        const policy = policies.find((p) => p.id === form.policy_id);
        sendTransactionalEmail({
          templateName: "invoice-issued",
          recipientEmail: c.email,
          idempotencyKey: `invoice-issued-${invoiceId}`,
          templateData: {
            clientName: clientDisplayName(c),
            invoiceNo: form.invoice_no,
            amount: formatKES(total),
            issueDate: form.issue_date,
            dueDate: form.due_date,
            policyNo: policy?.policy_no ?? '',
          },
        });
      });
    }
    onSaved?.(); onOpenChange(false);
  };

  const pForClient = form.client_id ? policies.filter((p) => p.client_id === form.client_id) : policies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Invoice #</Label><Input value={form.invoice_no ?? ""} onChange={(e) => set("invoice_no", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["draft","sent","partial","paid","void","overdue"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Policy</Label>
            <Select value={form.policy_id ?? ""} onValueChange={(v) => set("policy_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{pForClient.map((p) => <SelectItem key={p.id} value={p.id}>{p.policy_no}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Issue date</Label><Input type="date" value={form.issue_date ?? ""} onChange={(e) => set("issue_date", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Due date *</Label><Input type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} /></div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Line items</Label>
            <Button size="sm" variant="outline" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0 }])}><Plus className="h-3 w-3 mr-1" /> Add line</Button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_120px_80px_32px] gap-2 items-center">
                <Input placeholder="Description" value={it.description} onChange={(e) => { const c = [...items]; c[idx].description = e.target.value; setItems(c); }} />
                <Input type="number" value={it.quantity} onChange={(e) => { const c = [...items]; c[idx].quantity = Number(e.target.value); setItems(c); }} />
                <Input type="number" value={it.unit_price} onChange={(e) => { const c = [...items]; c[idx].unit_price = Number(e.target.value); setItems(c); }} />
                <div className="text-right text-sm">{(it.quantity * it.unit_price).toLocaleString()}</div>
                <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Tax</Label><Input type="number" value={form.tax ?? 0} onChange={(e) => set("tax", Number(e.target.value))} /></div>
          <div className="space-y-1 text-right pr-2 self-end text-sm">
            <div>Subtotal: <span className="font-mono">KES {subtotal.toLocaleString()}</span></div>
            <div className="text-lg font-semibold">Total: <span className="font-mono">KES {total.toLocaleString()}</span></div>
          </div>
        </div>

        <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.invoice_no || !form.client_id || !form.due_date}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}