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
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["reported","under_review","approved","rejected","settled","closed"];

export const Route = createFileRoute("/_authenticated/claims")({ beforeLoad: requireRole(["admin", "manager", "agent"]), component: ClaimsPage });

function ClaimsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [status, setStatus] = useState("all");

  const { data } = useQuery({
    queryKey: ["claims", status],
    queryFn: async () => {
      let q = supabase.from("claims")
        .select("*, clients(full_name, company_name, client_type), policies(policy_no), vehicles(registration_no)")
        .order("created_at", { ascending: false }).limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error; return data;
    },
  });

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Claims" subtitle="Incident reports tracked from first notice to settlement."
        actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New claim</Button>} />
      <div className="flex gap-1 flex-wrap">
        {["all", ...STATUSES].map(s => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>{s.replace("_", " ")}</Button>
        ))}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Claim #</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Policy</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Incident</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">No claims yet.</td></tr>}
              {data?.map((c: any) => {
                const cl = c.clients; const name = cl ? (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) : "—";
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">{c.claim_no}</td>
                    <td className="px-4 py-3">{name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.policies?.policy_no ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.vehicles?.registration_no ?? "—"}</td>
                    <td className="px-4 py-3">{c.incident_date ?? "—"}</td>
                    <td className="px-4 py-3">{c.claim_amount ? `KES ${Number(c.claim_amount).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{c.status.replace("_"," ")}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <ClaimDialog open={open} onOpenChange={setOpen} initial={edit} onSaved={() => qc.invalidateQueries({ queryKey: ["claims"] })} />
    </div>
  );
}

function ClaimDialog({ open, onOpenChange, initial, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  const [clients, setClients] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(initial ?? { claim_no: `CLM-${Date.now()}`, status: "reported", incident_date: new Date().toISOString().slice(0,10) });
    supabase.from("clients").select("id, full_name, company_name, client_type").order("full_name").then(({ data }) => setClients(data ?? []));
    supabase.from("policies").select("id, policy_no, client_id").then(({ data }) => setPolicies(data ?? []));
    supabase.from("vehicles").select("id, registration_no, client_id").then(({ data }) => setVehicles(data ?? []));
  }, [open, initial]);

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, created_by: u.user?.id };
    const op = initial?.id
      ? supabase.from("claims").update(payload).eq("id", initial.id).select("id, status").single()
      : supabase.from("claims").insert(payload).select("id, status").single();
    const { data: saved, error } = await op as any;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    if (saved?.id && form.client_id) {
      const { sendTransactionalEmail, clientDisplayName } = await import("@/lib/email/send");
      const { data: c } = await supabase.from("clients").select("email, full_name, company_name, client_type").eq("id", form.client_id).maybeSingle();
      if (c?.email) {
        const policy = policies.find((p) => p.id === form.policy_id);
        if (!initial?.id) {
          sendTransactionalEmail({
            templateName: "claim-acknowledgement",
            recipientEmail: c.email,
            idempotencyKey: `claim-ack-${saved.id}`,
            templateData: {
              clientName: clientDisplayName(c),
              claimNo: form.claim_no,
              policyNo: policy?.policy_no ?? '',
              incidentDate: form.incident_date ?? '',
              description: form.description ?? '',
            },
          });
        } else if (initial.status !== saved.status) {
          sendTransactionalEmail({
            templateName: "claim-update",
            recipientEmail: c.email,
            idempotencyKey: `claim-update-${saved.id}-${saved.status}`,
            templateData: {
              clientName: clientDisplayName(c),
              claimNo: form.claim_no,
              status: String(saved.status).replace(/_/g, ' '),
              notes: form.notes ?? '',
            },
          });
        }
      }
    }
    onSaved?.(); onOpenChange(false);
  };

  const pForClient = form.client_id ? policies.filter((p) => p.client_id === form.client_id) : policies;
  const vForClient = form.client_id ? vehicles.filter((v) => v.client_id === form.client_id) : vehicles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit claim" : "New claim"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Claim #</Label><Input value={form.claim_no ?? ""} onChange={(e) => set("claim_no", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
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
          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            <Select value={form.vehicle_id ?? ""} onValueChange={(v) => set("vehicle_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{vForClient.map((v) => <SelectItem key={v.id} value={v.id}>{v.registration_no}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Incident date</Label><Input type="date" value={form.incident_date ?? ""} onChange={(e) => set("incident_date", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Location</Label><Input value={form.incident_location ?? ""} onChange={(e) => set("incident_location", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Claim amount</Label><Input type="number" value={form.claim_amount ?? ""} onChange={(e) => set("claim_amount", e.target.value ? Number(e.target.value) : null)} /></div>
          <div className="space-y-1.5"><Label>Settled amount</Label><Input type="number" value={form.settled_amount ?? ""} onChange={(e) => set("settled_amount", e.target.value ? Number(e.target.value) : null)} /></div>
          <div className="space-y-1.5"><Label>Settled date</Label><Input type="date" value={form.settled_date ?? ""} onChange={(e) => set("settled_date", e.target.value || null)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.claim_no || !form.client_id}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}