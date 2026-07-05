import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendTransactionalEmail, clientDisplayName, formatKES } from "@/lib/email/send";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (id?: string) => void;
  initial?: any;
  renewFrom?: any; // policy being renewed (carry forward many fields)
};

export function PolicyFormDialog({ open, onOpenChange, onSaved, initial, renewFrom }: Props) {
  const [form, setForm] = useState<any>({});
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    if (initial) setForm(initial);
    else if (renewFrom) {
      const oldEnd = new Date(renewFrom.end_date);
      const newStart = new Date(oldEnd); newStart.setDate(newStart.getDate() + 1);
      const newEnd = new Date(newStart); newEnd.setFullYear(newEnd.getFullYear() + 1);
      setForm({
        ...renewFrom,
        id: undefined,
        policy_no: "",
        previous_policy_id: renewFrom.id,
        start_date: newStart.toISOString().slice(0, 10),
        end_date: newEnd.toISOString().slice(0, 10),
        status: "active",
        payment_status: "unpaid",
        document_url: null,
      });
    } else {
      const today = new Date();
      const yr = new Date(today); yr.setFullYear(yr.getFullYear() + 1);
      setForm({
        product_class: "motor_private",
        cover_type: "comprehensive",
        status: "active",
        payment_status: "unpaid",
        start_date: today.toISOString().slice(0, 10),
        end_date: yr.toISOString().slice(0, 10),
      });
    }
    supabase.from("clients").select("id, full_name, company_name, client_type").order("full_name").limit(500).then(({ data }) => setClients(data ?? []));
    supabase.from("vehicles").select("id, registration_no, client_id").order("registration_no").limit(1000).then(({ data }) => setVehicles(data ?? []));
    supabase.from("tenant_insurers").select("insurers(id, name, active)").eq("enabled", true).then(({ data }) => {
      const rows = (data ?? []).map((r: any) => r.insurers).filter((i: any) => i && i.active).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setInsurers(rows);
    });
    supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data ?? []));
  }, [open, initial, renewFrom]);

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const allowed = [
      "policy_no","client_id","vehicle_id","insurer_id","branch_id",
      "product_class","cover_type","sum_insured","premium_gross","premium_net",
      "commission","taxes","start_date","end_date","status","payment_status",
      "previous_policy_id","document_url","notes",
    ];
    const payload: any = {};
    for (const k of allowed) if (form[k] !== undefined) payload[k] = form[k];
    const op = initial?.id
      ? supabase.from("policies").update(payload).eq("id", initial.id)
      : supabase.from("policies").insert({ ...payload, created_by: u.user?.id }).select("id").single();
    const { data, error } = await op as any;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial?.id ? "Policy updated" : "Policy created");
    if (!initial?.id && data?.id && form.client_id) {
      const client = clients.find((c) => c.id === form.client_id);
      const insurer = insurers.find((i) => i.id === form.insurer_id);
      // fetch client email (not in cached list)
      supabase.from("clients").select("email, full_name, company_name, client_type").eq("id", form.client_id).maybeSingle().then(({ data: c }) => {
        if (!c?.email) return;
        sendTransactionalEmail({
          templateName: "policy-issued",
          recipientEmail: c.email,
          idempotencyKey: `policy-issued-${data.id}`,
          templateData: {
            clientName: clientDisplayName(c),
            policyNo: form.policy_no,
            insurerName: insurer?.name ?? 'your insurer',
            startDate: form.start_date,
            endDate: form.end_date,
            premium: form.premium_gross ? formatKES(form.premium_gross) : '',
          },
        });
      });
    }
    onSaved?.(data?.id ?? initial?.id);
    onOpenChange(false);
  };

  const vehiclesForClient = form.client_id ? vehicles.filter((v) => v.client_id === form.client_id) : vehicles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit policy" : renewFrom ? "Renew policy" : "New policy"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Policy number *" value={form.policy_no} onChange={(v) => set("policy_no", v)} />
          <div className="space-y-1.5 min-w-0">
            <Label>Branch</Label>
            <Select value={form.branch_id ?? ""} onValueChange={(v) => set("branch_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>Client *</Label>
            <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>Vehicle</Label>
            <Select value={form.vehicle_id ?? ""} onValueChange={(v) => set("vehicle_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{vehiclesForClient.map((v) => <SelectItem key={v.id} value={v.id}>{v.registration_no}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>Insurer</Label>
            <Select value={form.insurer_id ?? ""} onValueChange={(v) => set("insurer_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Insurer" /></SelectTrigger>
              <SelectContent>{insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>Product class</Label>
            <Select value={form.product_class} onValueChange={(v) => set("product_class", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="motor_private">Motor — Private</SelectItem>
                <SelectItem value="motor_commercial">Motor — Commercial</SelectItem>
                <SelectItem value="psv">PSV</SelectItem>
                <SelectItem value="fire">Fire</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
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
          <F label="Sum insured" type="number" value={form.sum_insured} onChange={(v) => set("sum_insured", v ? Number(v) : null)} />
          <F label="Gross premium" type="number" value={form.premium_gross} onChange={(v) => set("premium_gross", v ? Number(v) : null)} />
          <F label="Net premium" type="number" value={form.premium_net} onChange={(v) => set("premium_net", v ? Number(v) : null)} />
          <F label="Commission" type="number" value={form.commission} onChange={(v) => set("commission", v ? Number(v) : null)} />
          <F label="Taxes" type="number" value={form.taxes} onChange={(v) => set("taxes", v ? Number(v) : null)} />
          <F label="Start date *" type="date" value={form.start_date} onChange={(v) => set("start_date", v)} />
          <F label="End date *" type="date" value={form.end_date} onChange={(v) => set("end_date", v)} />
          <div className="space-y-1.5 min-w-0">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="renewed">Renewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>Payment status</Label>
            <Select value={form.payment_status} onValueChange={(v) => set("payment_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.policy_no || !form.client_id || !form.start_date || !form.end_date}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, value, onChange, type = "text" }: { label: string; value?: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label>{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}