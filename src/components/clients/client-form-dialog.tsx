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
  const [creds, setCreds] = useState<{ email: string; password: string | null; linked: boolean } | null>(null);
  const portalFn = useServerFn(createClientPortalAccount);

  useEffect(() => {
    if (open) {
      setForm(initial ?? { client_type: "individual" });
      supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data ?? []));
    }
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, created_by: u.user?.id };
    const op = initial?.id
      ? supabase.from("clients").update(payload).eq("id", initial.id)
      : supabase.from("clients").insert(payload).select("id").single();
    const { data: saved, error } = await op as any;
    if (error) { setSaving(false); return toast.error(error.message); }
    toast.success(initial?.id ? "Client updated" : "Client created");
    if (!initial?.id && form.email && saved?.id) {
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
    if (initial?.id || !form.email) onOpenChange(false);
    // when creds were created, keep dialog state but show creds dialog instead
    if (!initial?.id && form.email) onOpenChange(false);
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
          <div className="space-y-1.5 min-w-0">
            <Label>Branch</Label>
            <Select value={form.branch_id ?? ""} onValueChange={(v) => set("branch_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Field label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} required />
          {form.client_type === "corporate" && <Field label="Company name" value={form.company_name} onChange={(v) => set("company_name", v)} />}
          <Field label="ID / Registration number" value={form.id_number} onChange={(v) => set("id_number", v)} />
          <Field label="KRA PIN" value={form.kra_pin} onChange={(v) => set("kra_pin", v)} />
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

export function CredentialsDialog({ creds, onClose }: { creds: { email: string; password: string | null; linked: boolean } | null; onClose: () => void }) {
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied"); };
  return (
    <Dialog open={!!creds} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Client portal login</DialogTitle></DialogHeader>
        {creds?.linked ? (
          <p className="text-sm text-muted-foreground">An existing account with this email was found and linked to the client. They can log in with their existing password.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Share these credentials with the client. The password is shown only once.</p>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <div className="flex gap-2"><Input readOnly value={creds?.email ?? ""} /><Button variant="outline" size="icon" onClick={() => copy(creds!.email)}><Copy className="h-4 w-4" /></Button></div>
            </div>
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