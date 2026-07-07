import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendTransactionalEmail, clientDisplayName } from "@/lib/email/send";
import { useServerFn } from "@tanstack/react-start";
import { createClientPortalAccount } from "@/lib/admin-users.functions";
import { Copy } from "lucide-react";
import { normalizePhone } from "@/lib/phone";
import { useMyRoles } from "@/hooks/use-auth";
import { checkPinByIdNumber, type KraIdType } from "@/lib/kra.functions";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export type PortalCreds = {
  email: string | null;
  phone: string | null;
  password: string | null;
  linked: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  initial?: Record<string, any> | null;
};

export function ClientFormDialog({ open, onOpenChange, onSaved, initial }: Props) {
  const [form, setForm] = useState<any>({ client_type: "individual" });
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [creds, setCreds] = useState<PortalCreds | null>(null);
  const portalFn = useServerFn(createClientPortalAccount);
  const { data: roles } = useMyRoles();
  const isAdmin = (roles ?? []).includes("admin");
  const kraFn = useServerFn(checkPinByIdNumber);
  const [kraChecking, setKraChecking] = useState(false);
  const [kraResult, setKraResult] = useState<
    | { ok: true; pin: string; taxpayer_name: string; status: string }
    | { ok: false; message: string }
    | null
  >(null);

  useEffect(() => {
    if (open) {
      setForm(initial ?? { client_type: "individual" });
      supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data ?? []));
      setKraResult(null);
    }
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const checkKra = async () => {
    if (!form.id_number) return;
    setKraChecking(true);
    setKraResult(null);
    try {
      const r = await kraFn({
        data: {
          id_number: String(form.id_number).trim(),
          id_type: (form.kra_id_type as KraIdType) ?? "national_id",
        },
      });
      if (r.ok) {
        setKraResult({ ok: true, pin: r.pin, taxpayer_name: r.taxpayer_name, status: r.status });
        setForm((f: any) => ({
          ...f,
          kra_pin: r.pin,
          kra_id_type: r.id_type,
          kra_verified_name: r.taxpayer_name,
          kra_verification_status: "verified",
          kra_verified_at: new Date().toISOString(),
        }));
      } else {
        setKraResult({ ok: false, message: r.message });
      }
    } catch (e: any) {
      setKraResult({ ok: false, message: e?.message ?? "Lookup failed" });
    } finally {
      setKraChecking(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const writable: Record<string, any> = {
      client_type: form.client_type ?? "individual",
      full_name: form.full_name ?? null,
      company_name: form.company_name ?? null,
      id_number: form.id_number ?? null,
      kra_pin: form.kra_pin ?? null,
      kra_id_type: form.kra_id_type ?? null,
      kra_verified_name: form.kra_verified_name ?? null,
      kra_verification_status: form.kra_verification_status ?? null,
      kra_verified_at: form.kra_verified_at ?? null,
      email: form.email ?? null,
      phone: normalizePhone(form.phone) ?? form.phone ?? null,
      alt_phone: normalizePhone(form.alt_phone) ?? form.alt_phone ?? null,
      city: form.city ?? null,
      address: form.address ?? null,
      notes: form.notes ?? null,
    };
    if (isAdmin) writable.branch_id = form.branch_id ?? null;
    const insertPayload = { ...writable, created_by: u.user?.id };
    const tbl = supabase.from("clients") as any;
    const op = initial?.id
      ? tbl.update(writable).eq("id", initial.id)
      : tbl.insert(insertPayload).select("id").single();
    const { data: saved, error } = await op as any;
    if (error) { setSaving(false); return toast.error(error.message); }
    toast.success(initial?.id ? "Client updated" : "Client created");
    if (!initial?.id && saved?.id && (writable.email || writable.phone)) {
      sendTransactionalEmail({
        templateName: "client-welcome",
        recipientEmail: form.email,
        idempotencyKey: `client-welcome-${saved.id}`,
        templateData: { clientName: clientDisplayName(form) },
      });
      // Auto-create portal login so the client doesn't need to self-register
      try {
        const res = await portalFn({ data: { client_id: saved.id } });
        setCreds(res);
      } catch (e: any) {
        toast.error(e?.message ?? "Could not create portal login");
      }
    }
    setSaving(false);
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 min-w-0">
            <Label>Client type</Label>
            <Select value={form.client_type} onValueChange={(v) => set("client_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAdmin ? (
            <div className="space-y-1.5 min-w-0">
              <Label>Branch</Label>
              <Select value={form.branch_id ?? ""} onValueChange={(v) => set("branch_id", v || null)}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5 min-w-0">
              <Label>Branch</Label>
              <p className="text-sm text-muted-foreground pt-2">Automatically assigned to your branch.</p>
            </div>
          )}
          <Field label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} required />
          {form.client_type === "corporate" && <Field label="Company name" value={form.company_name} onChange={(v) => set("company_name", v)} />}
          <div className="space-y-1.5 min-w-0">
            <Label>ID type</Label>
            <Select value={form.kra_id_type ?? "national_id"} onValueChange={(v) => set("kra_id_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="national_id">National ID</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="service_id">Service ID</SelectItem>
                <SelectItem value="alien_id">Alien ID</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>ID / Registration number</Label>
            <div className="flex gap-2">
              <Input value={form.id_number ?? ""} onChange={(e) => set("id_number", e.target.value)} />
              <Button type="button" variant="outline" onClick={checkKra} disabled={!form.id_number || kraChecking}>
                {kraChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check KRA"}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 min-w-0 sm:col-span-2">
            <Label>KRA PIN</Label>
            <Input value={form.kra_pin ?? ""} onChange={(e) => set("kra_pin", e.target.value)} />
            {kraResult?.ok && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified — {kraResult.taxpayer_name || "Taxpayer"} ({kraResult.status})
              </p>
            )}
            {kraResult && !kraResult.ok && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> {kraResult.message}
              </p>
            )}
            {!kraResult && form.kra_verified_name && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" /> Previously verified as {form.kra_verified_name}
              </p>
            )}
          </div>
          <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="Alt. phone" value={form.alt_phone} onChange={(v) => set("alt_phone", v)} />
          <Field label="City" value={form.city} onChange={(v) => set("city", v)} />
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Address</Label>
            <Textarea rows={2} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.full_name}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value?: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

export function CredentialsDialog({ creds, onClose }: { creds: PortalCreds | null; onClose: () => void }) {
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied"); };
  const identifier = creds?.phone || creds?.email || "";
  const identifierLabel = creds?.phone ? "Phone" : "Email";

  const copyAll = () => {
    if (!creds) return;
    const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/portal` : "https://app.zestinsurance.co.ke/portal";
    const lines = [
      "Your Zest Insurance portal login details:",
      "",
      `Login link: ${portalUrl}`,
      ...(creds.phone ? [`Phone: ${creds.phone}`] : []),
      ...(creds.email ? [`Email: ${creds.email}`] : []),
      ...(creds.password ? [`Temporary password: ${creds.password}`] : []),
      "",
      "Please keep this information secure and change your password after signing in.",
    ];
    copy(lines.join("\n"));
  };

  return (
    <Dialog open={!!creds} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Client portal login</DialogTitle></DialogHeader>
        {creds?.linked ? (
          <p className="text-sm text-muted-foreground">An existing account was found and linked to this client. They can log in with their existing password.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-muted-foreground">Share these credentials with the client. They can sign in with either their phone or email. The password is shown only once.</p>
              <Button variant="outline" size="sm" className="shrink-0" onClick={copyAll}>
                <Copy className="h-4 w-4 mr-1" /> Copy all
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>{identifierLabel}</Label>
              <div className="flex gap-2"><Input readOnly value={identifier} /><Button variant="outline" size="icon" onClick={() => copy(identifier)}><Copy className="h-4 w-4" /></Button></div>
            </div>
            {creds?.phone && creds?.email && (
              <div className="space-y-1.5">
                <Label>Email (alternate)</Label>
                <div className="flex gap-2"><Input readOnly value={creds.email} /><Button variant="outline" size="icon" onClick={() => copy(creds.email!)}><Copy className="h-4 w-4" /></Button></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Temporary password</Label>
              <div className="flex gap-2"><Input readOnly value={creds?.password ?? ""} className="font-mono" /><Button variant="outline" size="icon" onClick={() => copy(creds!.password ?? "")}><Copy className="h-4 w-4" /></Button></div>
            </div>
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}