import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  initial?: any;
  defaultClientId?: string;
};

export function VehicleFormDialog({ open, onOpenChange, onSaved, initial, defaultClientId }: Props) {
  const [form, setForm] = useState<any>({});
  const [clients, setClients] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(initial ?? { client_id: defaultClientId, usage_type: "private" });
    supabase.from("clients").select("id, full_name, company_name, client_type").order("full_name").limit(500).then(({ data }) => setClients(data ?? []));
    supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data ?? []));
  }, [open, initial, defaultClientId]);

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, created_by: u.user?.id };
    const op = initial?.id ? supabase.from("vehicles").update(payload).eq("id", initial.id) : supabase.from("vehicles").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial?.id ? "Vehicle updated" : "Vehicle added");
    onSaved?.(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit vehicle" : "New vehicle"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5 min-w-0">
            <Label>Client *</Label>
            <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)} disabled={!!defaultClientId}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <F label="Registration *" value={form.registration_no} onChange={(v) => set("registration_no", v.toUpperCase())} />
          <div className="space-y-1.5 min-w-0">
            <Label>Branch</Label>
            <Select value={form.branch_id ?? ""} onValueChange={(v) => set("branch_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <F label="Make" value={form.make} onChange={(v) => set("make", v)} />
          <F label="Model" value={form.model} onChange={(v) => set("model", v)} />
          <F label="Year" type="number" value={form.year} onChange={(v) => set("year", v ? Number(v) : null)} />
          <F label="Color" value={form.color} onChange={(v) => set("color", v)} />
          <F label="Chassis no" value={form.chassis_no} onChange={(v) => set("chassis_no", v)} />
          <F label="Engine no" value={form.engine_no} onChange={(v) => set("engine_no", v)} />
          <div className="space-y-1.5 min-w-0">
            <Label>Fuel</Label>
            <Select value={form.fuel_type ?? ""} onValueChange={(v) => set("fuel_type", v)}>
              <SelectTrigger><SelectValue placeholder="Fuel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="petrol">Petrol</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="electric">Electric</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>Usage</Label>
            <Select value={form.usage_type ?? "private"} onValueChange={(v) => set("usage_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="psv">PSV</SelectItem>
                <SelectItem value="hire">Hire</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <F label="Seating capacity" type="number" value={form.seating_capacity} onChange={(v) => set("seating_capacity", v ? Number(v) : null)} />
          <F label="Cubic capacity" type="number" value={form.cubic_capacity} onChange={(v) => set("cubic_capacity", v ? Number(v) : null)} />
          <F label="Estimated value (KES)" type="number" value={form.estimated_value} onChange={(v) => set("estimated_value", v ? Number(v) : null)} />
          <F label="Inspection due" type="date" value={form.inspection_due} onChange={(v) => set("inspection_due", v || null)} />
          <div className="sm:col-span-2 space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.client_id || !form.registration_no}>{saving ? "Saving…" : "Save"}</Button>
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