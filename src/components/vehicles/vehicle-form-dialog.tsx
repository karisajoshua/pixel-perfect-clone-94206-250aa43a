import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { extractLogbookFields } from "@/lib/vehicles.functions";

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
  const [lockedClient, setLockedClient] = useState<{ id: string; label: string } | null>(null);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const extractFn = useServerFn(extractLogbookFields);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(initial ?? { client_id: defaultClientId, usage_type: "private" });
    setAutoFilled(new Set());
    const lockedId = initial?.client_id ?? defaultClientId ?? null;
    if (lockedId) {
      supabase.from("clients").select("id, full_name, company_name, client_type").eq("id", lockedId).maybeSingle().then(({ data }) => {
        if (data) setLockedClient({ id: data.id, label: data.client_type === "corporate" ? (data.company_name ?? data.full_name) : data.full_name });
      });
    } else {
      setLockedClient(null);
    }
    supabase.from("clients").select("id, full_name, company_name, client_type").order("full_name").limit(500).then(({ data }) => setClients(data ?? []));
    supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data ?? []));
  }, [open, initial, defaultClientId]);

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const COLS = [
      "client_id","branch_id","registration_no","make","model","year","body_type",
      "color","chassis_no","engine_no","fuel_type","seating_capacity","cubic_capacity",
      "usage_type","estimated_value","inspection_due","notes","active",
    ] as const;
    const clean: any = {};
    for (const k of COLS) if (form[k] !== undefined) clean[k] = form[k];
    const op = initial?.id
      ? supabase.from("vehicles").update(clean).eq("id", initial.id)
      : supabase.from("vehicles").insert({ ...clean, created_by: u.user?.id } as any);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial?.id ? "Vehicle updated" : "Vehicle added");
    onSaved?.(); onOpenChange(false);
  };

  const onScanFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) { toast.error("File is too large (max 15MB)"); return; }
    setScanning(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const fields = await extractFn({ data: { file_data_url: dataUrl, mime_type: file.type || "image/jpeg", filename: file.name } });
      const filledKeys: string[] = [];
      setForm((f: any) => {
        const next = { ...f };
        for (const [k, v] of Object.entries(fields)) {
          if (next[k] === undefined || next[k] === null || next[k] === "") {
            next[k] = v;
            filledKeys.push(k);
          }
        }
        return next;
      });
      if (filledKeys.length === 0) toast.message("Logbook read — all matching fields were already filled.");
      else { setAutoFilled(new Set(filledKeys)); toast.success(`Logbook scanned — filled ${filledKeys.length} field${filledKeys.length === 1 ? "" : "s"}. Please review.`); }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read logbook");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit vehicle" : "New vehicle"}</DialogTitle></DialogHeader>
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2.5">
          <div className="text-sm">
            <div className="font-medium">Scan log book</div>
            <div className="text-xs text-muted-foreground">Auto-fill vehicle details from a photo or PDF of the log book.</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onScanFile(f); }} />
          <Button type="button" variant="outline" size="sm" disabled={scanning} onClick={() => fileRef.current?.click()}>
            {scanning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ScanLine className="h-4 w-4 mr-1" />}
            {scanning ? "Scanning…" : "Scan log book"}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5 min-w-0">
            <Label>Client *</Label>
            {lockedClient ? (
              <Input value={lockedClient.label} readOnly disabled />
            ) : (
              <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <F label="Registration *" value={form.registration_no} onChange={(v) => set("registration_no", v.toUpperCase())} auto={autoFilled.has("registration_no")} />
          <div className="space-y-1.5 min-w-0">
            <Label>Branch</Label>
            <Select value={form.branch_id ?? ""} onValueChange={(v) => set("branch_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <F label="Make" value={form.make} onChange={(v) => set("make", v)} auto={autoFilled.has("make")} />
          <F label="Model" value={form.model} onChange={(v) => set("model", v)} auto={autoFilled.has("model")} />
          <F label="Year" type="number" value={form.year} onChange={(v) => set("year", v ? Number(v) : null)} auto={autoFilled.has("year")} />
          <F label="Color" value={form.color} onChange={(v) => set("color", v)} auto={autoFilled.has("color")} />
          <F label="Chassis no" value={form.chassis_no} onChange={(v) => set("chassis_no", v)} auto={autoFilled.has("chassis_no")} />
          <F label="Engine no" value={form.engine_no} onChange={(v) => set("engine_no", v)} auto={autoFilled.has("engine_no")} />
          <div className="space-y-1.5 min-w-0">
            <Label className="flex items-center gap-2">Fuel {autoFilled.has("fuel_type") && <Badge variant="secondary" className="text-[10px] px-1 py-0">auto</Badge>}</Label>
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
            <Label className="flex items-center gap-2">Usage {autoFilled.has("usage_type") && <Badge variant="secondary" className="text-[10px] px-1 py-0">auto</Badge>}</Label>
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
          <F label="Seating capacity" type="number" value={form.seating_capacity} onChange={(v) => set("seating_capacity", v ? Number(v) : null)} auto={autoFilled.has("seating_capacity")} />
          <F label="Cubic capacity" type="number" value={form.cubic_capacity} onChange={(v) => set("cubic_capacity", v ? Number(v) : null)} auto={autoFilled.has("cubic_capacity")} />
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

function F({ label, value, onChange, type = "text", auto }: { label: string; value?: any; onChange: (v: string) => void; type?: string; auto?: boolean }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="flex items-center gap-2">{label} {auto && <Badge variant="secondary" className="text-[10px] px-1 py-0">auto</Badge>}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={auto ? "ring-1 ring-primary/40" : ""} />
    </div>
  );
}