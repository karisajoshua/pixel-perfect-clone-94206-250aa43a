import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { Plus, Pencil, ArrowRight, Download, Check, X, Send } from "lucide-react";
import { toast } from "sonner";
import { downloadQuotationPdf } from "@/lib/quotation-pdf";
import { useMyRoles } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/quotations")({ beforeLoad: requireRole(["admin", "manager", "agent"]), component: QuotationsPage });

function QuotationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const { data: roles } = useMyRoles();
  const canApprove = (roles ?? []).some((r) => r === "admin" || r === "manager");

  const { data } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotations")
        .select("*, clients(full_name, company_name, client_type), insurers(name), vehicles(registration_no)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const convert = async (q: any) => {
    if (!confirm(`Convert ${q.quote_no} to a policy?`)) return;
    const { data: u } = await supabase.auth.getUser();
    const today = new Date(); const yr = new Date(today); yr.setFullYear(yr.getFullYear() + 1);
    const { data, error } = await supabase.from("policies").insert({
      policy_no: `POL-${Date.now()}`,
      client_id: q.client_id, vehicle_id: q.vehicle_id, insurer_id: q.insurer_id, branch_id: q.branch_id,
      product_class: q.product_class, cover_type: q.cover_type,
      sum_insured: q.sum_insured, premium_gross: q.premium_gross, premium_net: q.premium_net,
      start_date: today.toISOString().slice(0,10), end_date: yr.toISOString().slice(0,10),
      status: "pending", payment_status: "unpaid",
      created_by: u.user?.id,
    }).select("id").single();
    if (error) return toast.error(error.message);
    await supabase.from("quotations").update({ status: "converted", converted_policy_id: data!.id }).eq("id", q.id);
    toast.success("Quote converted to policy. Update the policy number.");
    qc.invalidateQueries({ queryKey: ["quotations"] });
    qc.invalidateQueries({ queryKey: ["policies"] });
  };

  const submitForApproval = async (q: any) => {
    const { error } = await supabase.from("quotations").update({ status: "pending_approval", approval_required: true }).eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Submitted for approval");
    qc.invalidateQueries({ queryKey: ["quotations"] });
  };

  const approve = async (q: any) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("quotations").update({ status: "approved", approved_by: u.user?.id, approved_at: new Date().toISOString(), rejection_reason: null }).eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Approved");
    qc.invalidateQueries({ queryKey: ["quotations"] });
  };

  const reject = async (q: any) => {
    const reason = prompt("Reason for rejection?") ?? "";
    if (!reason) return;
    const { error } = await supabase.from("quotations").update({ status: "rejected", rejection_reason: reason }).eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    qc.invalidateQueries({ queryKey: ["quotations"] });
  };

  const revise = async (q: any) => {
    if (!confirm(`Create a new revision of ${q.quote_no}?`)) return;
    const { data: u } = await supabase.auth.getUser();
    const { id, created_at, updated_at, clients, insurers, vehicles, approved_by, approved_at, ...base } = q as any;
    const newQuote = {
      ...base,
      quote_no: `${q.quote_no}-R${(q.revision ?? 1) + 1}`,
      status: "draft",
      revision: (q.revision ?? 1) + 1,
      parent_quote_id: q.id,
      approval_required: false,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      converted_policy_id: null,
      created_by: u.user?.id,
    };
    const { error } = await supabase.from("quotations").insert(newQuote);
    if (error) return toast.error(error.message);
    toast.success("Revision created");
    qc.invalidateQueries({ queryKey: ["quotations"] });
  };

  const handleDownload = async (quoteId: string) => {
    const t = toast.loading("Preparing PDF…");
    try {
      const { data, error } = await supabase.from("quotations")
        .select("*, clients(id, full_name, company_name, client_type, email, phone), insurers(name), vehicles(registration_no, make, model, year), branches(name, address, phone, email)")
        .eq("id", quoteId).single();
      if (error || !data) throw new Error(error?.message ?? "Failed to load quotation");
      const q: any = data;
      await downloadQuotationPdf({ quotation: q, client: q.clients, branch: q.branches, insurer: q.insurers, vehicle: q.vehicles });
      toast.success("Quotation downloaded", { id: t });
    } catch (e: any) {
      console.error("Quotation download failed", e);
      toast.error(e?.message ?? "Download failed", { id: t });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Quotations" subtitle="Quote drafts that can be converted into policies."
        actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New quote</Button>} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Quote #</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Insurer</th>
                <th className="px-4 py-3 font-medium">Premium</th>
                <th className="px-4 py-3 font-medium">Valid until</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">No quotes yet.</td></tr>}
              {data?.map((q: any) => {
                const cl = q.clients; const name = cl ? (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) : "—";
                return (
                  <tr key={q.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">{q.quote_no}</td>
                    <td className="px-4 py-3">{name}</td>
                    <td className="px-4 py-3">{q.insurers?.name ?? "—"}</td>
                    <td className="px-4 py-3">{q.premium_gross ? `KES ${Number(q.premium_gross).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">{q.valid_until ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant={q.status === "converted" ? "default" : "secondary"}>{q.status}</Badge></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(q.id)}><Download className="h-4 w-4 mr-1" /> PDF</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEdit(q); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      {q.status === "draft" && (
                        <Button size="sm" variant="ghost" onClick={() => submitForApproval(q)}><Send className="h-3 w-3 mr-1" /> Submit</Button>
                      )}
                      {q.status === "pending_approval" && canApprove && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => approve(q)}><Check className="h-3 w-3 mr-1" /> Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => reject(q)}><X className="h-3 w-3 mr-1" /> Reject</Button>
                        </>
                      )}
                      {(q.status === "rejected" || q.status === "expired") && (
                        <Button size="sm" variant="ghost" onClick={() => revise(q)}>Revise</Button>
                      )}
                      {q.status !== "converted" && (
                        <Button size="sm" variant="outline" onClick={() => convert(q)}>Convert <ArrowRight className="h-3 w-3 ml-1" /></Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <QuoteDialog open={open} onOpenChange={setOpen} initial={edit} onSaved={() => qc.invalidateQueries({ queryKey: ["quotations"] })} />
    </div>
  );
}

function QuoteDialog({ open, onOpenChange, initial, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  const [clients, setClients] = useState<any[]>([]);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    const v = new Date(); v.setDate(v.getDate() + 14);
    setForm(initial ?? { quote_no: `Q-${Date.now()}`, status: "draft", product_class: "motor_private", cover_type: "comprehensive", valid_until: v.toISOString().slice(0,10) });
    supabase.from("clients").select("id, full_name, company_name, client_type").order("full_name").then(({ data }) => setClients(data ?? []));
    supabase.from("insurers").select("id, name").eq("active", true).order("name").then(({ data }) => setInsurers(data ?? []));
    supabase.from("vehicles").select("id, registration_no, client_id").then(({ data }) => setVehicles(data ?? []));
  }, [open, initial]);

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, created_by: u.user?.id };
    const op = initial?.id
      ? supabase.from("quotations").update(payload).eq("id", initial.id).select("id").single()
      : supabase.from("quotations").insert(payload).select("id").single();
    const { data: saved, error } = await op as any;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    if (saved?.id && form.client_id) {
      const { sendTransactionalEmail, clientDisplayName, formatKES } = await import("@/lib/email/send");
      const { data: c } = await supabase.from("clients").select("email, full_name, company_name, client_type").eq("id", form.client_id).maybeSingle();
      if (c?.email) {
        const insurer = insurers.find((i: any) => i.id === form.insurer_id);
        sendTransactionalEmail({
          templateName: "quotation-sent",
          recipientEmail: c.email,
          idempotencyKey: `quotation-sent-${saved.id}`,
          templateData: {
            clientName: clientDisplayName(c),
            quoteNo: form.quote_no,
            insurerName: insurer?.name ?? '',
            premium: form.premium_gross ? formatKES(form.premium_gross) : '',
            sumInsured: form.sum_insured ? formatKES(form.sum_insured) : '',
            validUntil: form.valid_until ?? '',
            productClass: form.product_class ?? '',
            coverType: form.cover_type ?? '',
          },
        });
      }
    }
    onSaved?.(); onOpenChange(false);
  };

  const vForClient = form.client_id ? vehicles.filter((v) => v.client_id === form.client_id) : vehicles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit quote" : "New quote"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Quote #</Label><Input value={form.quote_no ?? ""} onChange={(e) => set("quote_no", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Valid until</Label><Input type="date" value={form.valid_until ?? ""} onChange={(e) => set("valid_until", e.target.value)} /></div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Client *</Label>
            <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            <Select value={form.vehicle_id ?? ""} onValueChange={(v) => set("vehicle_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{vForClient.map((v) => <SelectItem key={v.id} value={v.id}>{v.registration_no}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Insurer</Label>
            <Select value={form.insurer_id ?? ""} onValueChange={(v) => set("insurer_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Insurer" /></SelectTrigger>
              <SelectContent>{insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cover type</Label>
            <Select value={form.cover_type} onValueChange={(v) => set("cover_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comprehensive">Comprehensive</SelectItem>
                <SelectItem value="third_party">Third party</SelectItem>
                <SelectItem value="third_party_fire_theft">TPFT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Sum insured</Label><Input type="number" value={form.sum_insured ?? ""} onChange={(e) => set("sum_insured", e.target.value ? Number(e.target.value) : null)} /></div>
          <div className="space-y-1.5"><Label>Gross premium</Label><Input type="number" value={form.premium_gross ?? ""} onChange={(e) => set("premium_gross", e.target.value ? Number(e.target.value) : null)} /></div>
          <div className="space-y-1.5"><Label>Net premium</Label><Input type="number" value={form.premium_net ?? ""} onChange={(e) => set("premium_net", e.target.value ? Number(e.target.value) : null)} /></div>
          <div className="sm:col-span-2 space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.quote_no || !form.client_id}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}