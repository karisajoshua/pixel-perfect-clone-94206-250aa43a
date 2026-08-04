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
import { extractLogbookFields, getClientLogbookDoc } from "@/lib/vehicles.functions";

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
  const [searchingClients, setSearchingClients] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [lockedClient, setLockedClient] = useState<{ id: string; label: string } | null>(null);
  const [clientText, setClientText] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [storedLogbook, setStoredLogbook] = useState<{ storage_path: string; file_name: string; doc_type: string } | null>(null);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [suggestedCoverId, setSuggestedCoverId] = useState<string | null>(null);
  const [suggestedCoverNo, setSuggestedCoverNo] = useState<string | null>(null);
  const [copiedCoverFrom, setCopiedCoverFrom] = useState<{ policy_no: string | null; reg: string | null } | null>(null);
  const [cover, setCover] = useState<any>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const extractFn = useServerFn(extractLogbookFields);
  const getStoredFn = useServerFn(getClientLogbookDoc);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(initial ?? { client_id: defaultClientId, usage_type: "private" });
    setAutoFilled(new Set());
    setClientText("");
    setClients([]);
    const lockedId = initial?.client_id ?? defaultClientId ?? null;
    if (lockedId) {
      supabase.from("clients").select("id, full_name, company_name, client_type").eq("id", lockedId).maybeSingle().then(({ data }) => {
        if (data) setLockedClient({ id: data.id, label: data.client_type === "corporate" ? (data.company_name ?? data.full_name) : data.full_name });
      });
    } else {
      setLockedClient(null);
    }
    supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data ?? []));
  }, [open, initial, defaultClientId]);

  // Load insurers + the vehicle's current cover
  useEffect(() => {
    if (!open) return;
    supabase.from("insurers").select("id, name").eq("active", true).order("name").then(({ data }) => setInsurers(data ?? []));
    setCover({});
    setCoverId(null);
    setSuggestedCoverId(null);
    setSuggestedCoverNo(null);
    setCopiedCoverFrom(null);
    let cancelled = false;
    const cols = "id, policy_no, certificate_no, start_date, end_date, insurer_id, policy_term, premium_gross, payment_status, balance_due, status, vehicles(registration_no)";
    const fill = (data: any) => setCover({
      policy_no: data.policy_no ?? "",
      certificate_no: data.certificate_no ?? "",
      start_date: data.start_date ?? "",
      end_date: data.end_date ?? "",
      insurer_id: data.insurer_id ?? "",
      policy_term: data.policy_term ?? "",
      premium_gross: data.premium_gross ?? "",
      payment_status: data.payment_status ?? "unpaid",
      balance_due: data.balance_due ?? "",
    });
    (async () => {
      // 1. A policy already linked to this vehicle
      if (initial?.id) {
        const { data } = await supabase
          .from("policies").select(cols)
          .eq("vehicle_id", initial.id).neq("status", "cancelled")
          .order("start_date", { ascending: false }).limit(1).maybeSingle();
        if (cancelled) return;
        if (data) { setCoverId(data.id); fill(data); return; }
      }
      // 2. Otherwise suggest the client's most recent unattached policy
      const clientId = initial?.client_id ?? defaultClientId;
      if (!clientId) return;
      const { data } = await supabase
        .from("policies").select(cols)
        .eq("client_id", clientId).is("vehicle_id", null).neq("status", "cancelled")
        .order("start_date", { ascending: false }).limit(1).maybeSingle();
      if (cancelled) return;
      if (data) {
        setSuggestedCoverId(data.id);
        setSuggestedCoverNo(data.policy_no ?? null);
        fill(data);
        return;
      }
      // 3. Otherwise copy the client's most recent policy (attached to another vehicle)
      const { data: other } = await supabase
        .from("policies").select(cols)
        .eq("client_id", clientId).neq("status", "cancelled")
        .order("start_date", { ascending: false }).limit(1).maybeSingle();
      if (cancelled || !other) return;
      setCopiedCoverFrom({ policy_no: other.policy_no ?? null, reg: (other as any).vehicles?.registration_no ?? null });
      fill(other);
    })();
    return () => { cancelled = true; };
  }, [open, initial?.id, initial?.client_id, defaultClientId]);

  // Hydrate typed text when editing an existing vehicle (fetch the single selected client)
  useEffect(() => {
    if (!open) return;
    if (!form.client_id || clientText || lockedClient) return;
    let cancelled = false;
    supabase.from("clients").select("id, full_name, company_name, client_type").eq("id", form.client_id).maybeSingle().then(({ data }) => {
      if (cancelled || !data) return;
      const name = data.client_type === "corporate" ? (data.company_name ?? data.full_name) : data.full_name;
      setClientText(name ?? "");
    });
    return () => { cancelled = true; };
  }, [open, form.client_id, lockedClient, clientText]);

  // Debounced server-side client search
  useEffect(() => {
    if (!open || lockedClient) return;
    const t = clientText.trim();
    if (t.length < 2) { setClients([]); setSearchingClients(false); return; }
    setSearchingClients(true);
    const esc = t.replace(/[%,()]/g, " ");
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, company_name, client_type")
        .or(`full_name.ilike.%${esc}%,company_name.ilike.%${esc}%`)
        .order("full_name")
        .limit(20);
      setClients(data ?? []);
      setSearchingClients(false);
    }, 250);
    return () => { clearTimeout(handle); setSearchingClients(false); };
  }, [open, clientText, lockedClient]);

  useEffect(() => {
    if (!open) return;
    const cid = form.client_id;
    if (!cid) { setStoredLogbook(null); return; }
    let cancelled = false;
    getStoredFn({ data: { client_id: cid } })
      .then((res) => { if (!cancelled) setStoredLogbook(res); })
      .catch(() => { if (!cancelled) setStoredLogbook(null); });
    return () => { cancelled = true; };
  }, [open, form.client_id, getStoredFn]);

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
    let vehicleId = initial?.id as string | undefined;
    if (vehicleId) {
      const { error } = await supabase.from("vehicles").update(clean).eq("id", vehicleId);
      if (error) { setSaving(false); return toast.error(error.message); }
    } else {
      const { data: created, error } = await supabase
        .from("vehicles")
        .insert({ ...clean, created_by: u.user?.id } as any)
        .select("id")
        .single();
      if (error || !created) { setSaving(false); return toast.error(error?.message ?? "Could not save vehicle"); }
      vehicleId = created.id;
    }

    // Cover details (optional) — update the existing policy or create one
    const hasCover = ["policy_no", "certificate_no", "start_date", "end_date", "insurer_id", "policy_term", "premium_gross"]
      .some((k) => cover[k]);
    if (hasCover) {
      const payload: any = {
        policy_no: cover.policy_no || null,
        certificate_no: cover.certificate_no || null,
        start_date: cover.start_date || null,
        end_date: cover.end_date || null,
        insurer_id: cover.insurer_id || null,
        policy_term: cover.policy_term || null,
        premium_gross: cover.premium_gross === "" || cover.premium_gross === undefined || cover.premium_gross === null
          ? null : Number(cover.premium_gross),
        payment_status: cover.payment_status || "unpaid",
        balance_due: cover.balance_due === "" || cover.balance_due === undefined || cover.balance_due === null
          ? null : Number(cover.balance_due),
      };
      if (coverId || suggestedCoverId) {
        const { error: pErr } = await supabase
          .from("policies")
          .update(coverId ? payload : { ...payload, vehicle_id: vehicleId })
          .eq("id", (coverId ?? suggestedCoverId)!);
        if (pErr) { setSaving(false); return toast.error(`Vehicle saved, but cover failed: ${pErr.message}`); }
      } else {
        if (!payload.policy_no || !payload.start_date || !payload.end_date) {
          setSaving(false);
          return toast.error("To add cover, provide policy number, commencement and expiry date.");
        }
        const { error: pErr } = await supabase.from("policies").insert({
          ...payload,
          client_id: form.client_id,
          vehicle_id: vehicleId,
          branch_id: form.branch_id ?? null,
          product_class: "motor",
          cover_type: "comprehensive",
          status: "active",
          created_by: u.user?.id,
        } as any);
        if (pErr) { setSaving(false); return toast.error(`Vehicle saved, but cover failed: ${pErr.message}`); }
      }
    }
    setSaving(false);
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

  const onScanStored = async () => {
    if (!storedLogbook || !form.client_id) return;
    setScanning(true);
    try {
      const fields = await extractFn({ data: { client_id: form.client_id, storage_path: storedLogbook.storage_path } });
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
      toast.error(e?.message ?? "Could not read stored logbook");
    } finally {
      setScanning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit vehicle" : "New vehicle"}</DialogTitle></DialogHeader>
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2.5">
          <div className="text-sm">
            <div className="font-medium">Scan log book</div>
            <div className="text-xs text-muted-foreground">
              {storedLogbook
                ? <>Using client's KYC {storedLogbook.doc_type.replace("_", " ")}: <span className="font-medium">{storedLogbook.file_name}</span></>
                : form.client_id
                  ? "No log book on file for this client. Upload one under Clients → KYC to reuse it, or scan a file now."
                  : "Auto-fill vehicle details from a photo or PDF of the log book."}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onScanFile(f); }} />
          <div className="flex flex-col items-end gap-1">
            <Button type="button" variant="outline" size="sm" disabled={scanning} onClick={() => storedLogbook ? onScanStored() : fileRef.current?.click()}>
              {scanning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ScanLine className="h-4 w-4 mr-1" />}
              {scanning ? "Scanning…" : storedLogbook ? "Scan client's log book" : "Scan log book"}
            </Button>
            {storedLogbook && (
              <button type="button" className="text-[11px] text-muted-foreground hover:underline" disabled={scanning} onClick={() => fileRef.current?.click()}>
                Upload different file
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5 min-w-0 relative">
            <Label>Client *</Label>
            {lockedClient ? (
              <Input value={lockedClient.label} readOnly disabled />
            ) : (
              <>
                <Input
                  placeholder="Search client by name…"
                  value={clientText}
                  onChange={(e) => { setClientText(e.target.value); setShowClientList(true); set("client_id", null); }}
                  onFocus={() => setShowClientList(true)}
                  onBlur={() => setTimeout(() => setShowClientList(false), 150)}
                />
            {showClientList && (clientText.trim().length >= 2) && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-56 overflow-auto">
                {searchingClients && <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>}
                {!searchingClients && clients.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No clients match.</div>}
                {!searchingClients && clients.map((c) => {
                  const name = c.client_type === "corporate" ? (c.company_name ?? c.full_name) : c.full_name;
                  return (
                    <button key={c.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setClientText(name ?? ""); set("client_id", c.id); setShowClientList(false); }}
                    >{name}</button>
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
              </>
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

        <div className="rounded-md border p-3 space-y-3">
          <div>
            <div className="text-sm font-medium">Cover details</div>
            <p className="text-xs text-muted-foreground">
              {coverId
                ? "Editing this vehicle's current policy."
                : suggestedCoverId
                  ? `Prefilled from this client's policy ${suggestedCoverNo ?? ""} — saving will link it to this vehicle.`
                  : copiedCoverFrom
                    ? `Copied from ${copiedCoverFrom.policy_no ?? "this client's policy"}${copiedCoverFrom.reg ? ` on ${copiedCoverFrom.reg}` : ""} — check the details before saving. A new policy record will be created for this vehicle.`
                    : "Optional — fill these in to record cover for this vehicle. Policy number, commencement and expiry are required to create one."}
            </p>
            {(suggestedCoverId || copiedCoverFrom) && (
              <button
                type="button"
                className="text-xs underline text-muted-foreground mt-1"
                onClick={() => { setSuggestedCoverId(null); setSuggestedCoverNo(null); setCopiedCoverFrom(null); setCover({}); }}
              >Clear and start blank</button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F label="Policy number" value={cover.policy_no} onChange={(v) => setCover((c: any) => ({ ...c, policy_no: v.toUpperCase() }))} />
            <F label="Certificate number" value={cover.certificate_no} onChange={(v) => setCover((c: any) => ({ ...c, certificate_no: v.toUpperCase() }))} />
            <F label="Commencement date" type="date" value={cover.start_date} onChange={(v) => setCover((c: any) => ({ ...c, start_date: v }))} />
            <F label="Expiry date" type="date" value={cover.end_date} onChange={(v) => setCover((c: any) => ({ ...c, end_date: v }))} />
            <div className="space-y-1.5 min-w-0">
              <Label>Insurer</Label>
              <Select value={cover.insurer_id || ""} onValueChange={(v) => setCover((c: any) => ({ ...c, insurer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Insurer" /></SelectTrigger>
                <SelectContent>{insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label>Policy term</Label>
              <Select value={cover.policy_term || ""} onValueChange={(v) => setCover((c: any) => ({ ...c, policy_term: v }))}>
                <SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tor">One month (TOR)</SelectItem>
                  <SelectItem value="one_month_extendable">One month extendable</SelectItem>
                  <SelectItem value="six_months">6 months</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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