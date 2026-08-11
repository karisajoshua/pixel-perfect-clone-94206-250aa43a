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
  const [clientText, setClientText] = useState("");
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const addDaysISO = (start: string, days: number) => {
    const d = new Date(start); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const addYearsISO = (start: string, years: number) => {
    const d = new Date(start); d.setFullYear(d.getFullYear() + years);
    return d.toISOString().slice(0, 10);
  };
  const endDateForTerm = (start: string, term: string) => {
    if (!start) return undefined;
    switch (term) {
      case "tor": return addDaysISO(start, 30);
      case "one_month_extendable": return addDaysISO(start, 30);
      case "second_installment": return addDaysISO(start, 30);
      case "rop": { const d = new Date(start); d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
      case "six_months": return addDaysISO(start, 180);
      case "annual": return addYearsISO(start, 1);
      default: return undefined;
    }
  };
  const onTermChange = (v: string) => {
    setForm((f: any) => {
      const end = endDateForTerm(f.start_date, v);
      return { ...f, policy_term: v, ...(end ? { end_date: end } : {}) };
    });
  };
  const onStartChange = (v: string) => {
    setForm((f: any) => {
      const end = f.policy_term ? endDateForTerm(v, f.policy_term) : undefined;
      return { ...f, start_date: v, ...(end ? { end_date: end } : {}) };
    });
  };

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
        policy_term: "annual",
        status: "active",
        payment_status: "unpaid",
        start_date: today.toISOString().slice(0, 10),
        end_date: yr.toISOString().slice(0, 10),
      });
    }
    setClientText("");
    setClientResults([]);
    setShowClientList(false);
    supabase.from("vehicles").select("id, registration_no, client_id").order("registration_no").limit(1000).then(({ data }) => setVehicles(data ?? []));
    supabase.from("tenant_insurers").select("insurers(id, name, active)").eq("enabled", true).then(({ data }) => {
      const rows = (data ?? []).map((r: any) => r.insurers).filter((i: any) => i && i.active);
      const seen = new Map<string, any>();
      for (const i of rows) if (!seen.has(i.id)) seen.set(i.id, { ...i, name: String(i.name ?? "").trim().toUpperCase() });
      setInsurers([...seen.values()].sort((a: any, b: any) => a.name.localeCompare(b.name)));
    });
    supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data ?? []));
  }, [open, initial, renewFrom]);

  // Hydrate typed text when editing/renewing (fetch the currently linked client)
  useEffect(() => {
    if (!open) return;
    if (!form.client_id || clientText) return;
    let cancelled = false;
    supabase.from("clients").select("id, full_name, company_name, client_type").eq("id", form.client_id).maybeSingle().then(({ data }) => {
      if (cancelled || !data) return;
      const name = data.client_type === "corporate" ? (data.company_name ?? data.full_name) : data.full_name;
      setClientText(name ?? "");
    });
    return () => { cancelled = true; };
  }, [open, form.client_id, clientText]);

  // Debounced server-side client search
  useEffect(() => {
    if (!open) return;
    const t = clientText.trim();
    if (t.length < 2) { setClientResults([]); setSearchingClients(false); return; }
    setSearchingClients(true);
    const esc = t.replace(/[%,()]/g, " ");
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, company_name, client_type, email, phone")
        .or(`full_name.ilike.%${esc}%,company_name.ilike.%${esc}%,email.ilike.%${esc}%,phone.ilike.%${esc}%`)
        .order("full_name")
        .limit(20);
      setClientResults(data ?? []);
      setSearchingClients(false);
    }, 250);
    return () => { clearTimeout(handle); setSearchingClients(false); };
  }, [open, clientText]);

  const submit = async () => {
    if (form.payment_status === "partial" && !form.premium_gross) {
      return toast.error("Enter the gross premium before marking a policy partially paid.");
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const allowed = [
      "policy_no","certificate_no","client_id","vehicle_id","insurer_id","branch_id",
      "product_class","cover_type","policy_term","sum_insured","premium_gross","premium_net",
      "commission","taxes","start_date","end_date","status","payment_status",
      "balance_due","previous_policy_id","document_url","notes","installment_plan","rop_of_policy_id",
    ];
    const payload: any = {};
    for (const k of allowed) if (form[k] !== undefined) payload[k] = form[k];
    if (form.cover_type === "third_party" || form.cover_type === "third_party_fire_theft") payload.taxes = 0;
    const op = initial?.id
      ? supabase.from("policies").update(payload).eq("id", initial.id)
      : supabase.from("policies").insert({ ...payload, created_by: u.user?.id }).select("id").single();
    const { data, error } = await op as any;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial?.id ? "Policy updated" : "Policy created");
    if (!initial?.id && data?.id && form.client_id) {
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
  const isThirdParty = form.cover_type === "third_party" || form.cover_type === "third_party_fire_theft";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit policy" : renewFrom ? "Renew policy" : "New policy"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Policy number *" value={form.policy_no} onChange={(v) => set("policy_no", v)} />
          <F label="Certificate number" value={form.certificate_no} onChange={(v) => set("certificate_no", v)} />
          <div className="space-y-1.5 min-w-0">
            <Label>Branch</Label>
            <Select value={form.branch_id ?? ""} onValueChange={(v) => set("branch_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0 relative">
            <Label>Client *</Label>
            <Input
              placeholder="Search client by name, email or phone…"
              value={clientText}
              onChange={(e) => { setClientText(e.target.value); setShowClientList(true); set("client_id", null); }}
              onFocus={() => setShowClientList(true)}
              onBlur={() => setTimeout(() => setShowClientList(false), 150)}
            />
            {showClientList && clientText.trim().length >= 2 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-56 overflow-auto">
                {searchingClients && <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>}
                {!searchingClients && clientResults.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No clients match.</div>}
                {!searchingClients && clientResults.map((c) => {
                  const name = c.client_type === "corporate" ? (c.company_name ?? c.full_name) : c.full_name;
                  return (
                    <button key={c.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setClientText(name ?? ""); set("client_id", c.id); set("vehicle_id", null); setShowClientList(false); }}
                    >
                      <div className="font-medium">{name}</div>
                      {(c.email || c.phone) && <div className="text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ")}</div>}
                    </button>
                  );
                })}
              </div>
            )}
            {showClientList && clientText.trim().length > 0 && clientText.trim().length < 2 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md px-3 py-2 text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </div>
            )}
            {clientText.trim() && !form.client_id && (
              <p className="text-xs text-muted-foreground">Pick a client from the list.</p>
            )}
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
          <div className="space-y-1.5 min-w-0">
            <Label>Policy term</Label>
            <Select value={form.policy_term ?? ""} onValueChange={onTermChange}>
              <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tor">One month (TOR)</SelectItem>
                <SelectItem value="one_month_extendable">One month extendable</SelectItem>
                <SelectItem value="second_installment">2nd installment</SelectItem>
                <SelectItem value="rop">Rest of period (ROP)</SelectItem>
                <SelectItem value="six_months">6 months</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <F label="Sum insured" type="number" value={form.sum_insured} onChange={(v) => set("sum_insured", v ? Number(v) : null)} />
          <F label="Gross premium" type="number" value={form.premium_gross} onChange={(v) => set("premium_gross", v ? Number(v) : null)} />
          <F label="Net premium" type="number" value={form.premium_net} onChange={(v) => set("premium_net", v ? Number(v) : null)} />
          <F label="Commission" type="number" value={form.commission} onChange={(v) => set("commission", v ? Number(v) : null)} />
          {!isThirdParty && (
            <F label="Taxes" type="number" value={form.taxes} onChange={(v) => set("taxes", v ? Number(v) : null)} />
          )}
          <F label="Start date *" type="date" value={form.start_date} onChange={onStartChange} />
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
          {form.payment_status !== "paid" && (
            <div className="space-y-1.5 min-w-0">
              <F label="Balance due (KES)" type="number" value={form.balance_due ?? ""} onChange={(v) => set("balance_due", v === "" ? null : Number(v))} />
              {form.payment_status === "partial" && !form.premium_gross && (
                <p className="text-xs text-destructive">Enter the gross premium so the outstanding balance can be shown.</p>
              )}
            </div>
          )}
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