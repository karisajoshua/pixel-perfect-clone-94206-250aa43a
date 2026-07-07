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
import { Plus, Pencil, Upload, Trash2, FileText, X, Send } from "lucide-react";
import { toast } from "sonner";
import { IpenFileClaimDialog } from "@/components/ipen/file-claim-dialog";

const STATUSES = ["reported","under_review","approved","rejected","settled","closed"];

export const Route = createFileRoute("/_authenticated/claims")({ beforeLoad: requireRole(["admin", "manager", "agent"]), component: ClaimsPage });

function ClaimsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [status, setStatus] = useState("all");
  const [ipenClaim, setIpenClaim] = useState<any>(null);

  const { data } = useQuery({
    queryKey: ["claims", status],
    queryFn: async () => {
      let q = supabase.from("claims")
        .select("*, clients(full_name, company_name, client_type), policies(policy_no, ipen_policy_id), vehicles(registration_no)")
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
                    <td className="px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <Badge variant="secondary">{c.status.replace("_"," ")}</Badge>
                        {c.ipen_claim_id && <Badge>IPEN</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!c.ipen_claim_id && (
                        <Button size="sm" variant="ghost" title="File via IPEN" onClick={() => setIpenClaim(c)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
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
      {ipenClaim && (
        <IpenFileClaimDialog
          open={!!ipenClaim}
          onOpenChange={(o) => { if (!o) setIpenClaim(null); }}
          claim={ipenClaim}
          onFiled={() => { setIpenClaim(null); qc.invalidateQueries({ queryKey: ["claims"] }); }}
        />
      )}
    </div>
  );
}

function ClaimDialog({ open, onOpenChange, initial, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  const [clients, setClients] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"incident" | "thirdparty" | "documents">("incident");
  const [thirdParties, setThirdParties] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(initial ?? { claim_no: `CLM-${Date.now()}`, status: "reported", incident_date: new Date().toISOString().slice(0,10), accident_statement: "" });
    setThirdParties(Array.isArray(initial?.third_party_details) ? initial.third_party_details : []);
    setTab("incident");
    if (initial?.id) loadDocs(initial.id); else setDocs([]);
    supabase.from("clients").select("id, full_name, company_name, client_type").order("full_name").then(({ data }) => setClients(data ?? []));
    supabase.from("policies").select("id, policy_no, client_id").then(({ data }) => setPolicies(data ?? []));
    supabase.from("vehicles").select("id, registration_no, client_id").then(({ data }) => setVehicles(data ?? []));
  }, [open, initial]);

  const loadDocs = async (claimId: string) => {
    const folders = ["abstract", "driver_license", "national_id", "sketch", "other"];
    const all: any[] = [];
    for (const folder of folders) {
      const { data } = await supabase.storage.from("claim-documents").list(`${claimId}/${folder}`, { limit: 50 });
      for (const f of data ?? []) {
        if (!f.name || !f.id) continue;
        const path = `${claimId}/${folder}/${f.name}`;
        const { data: signed } = await supabase.storage.from("claim-documents").createSignedUrl(path, 60 * 30);
        all.push({ folder, name: f.name, path, url: signed?.signedUrl });
      }
    }
    setDocs(all);
  };

  const uploadDoc = async (folder: string, file: File) => {
    if (!initial?.id) return toast.error("Save the claim first to attach documents.");
    setUploading(true);
    const path = `${initial.id}/${folder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("claim-documents").upload(path, file, { upsert: false });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Uploaded");
    loadDocs(initial.id);
  };

  const removeDoc = async (path: string) => {
    if (!confirm("Delete this document?")) return;
    const { error } = await supabase.storage.from("claim-documents").remove([path]);
    if (error) return toast.error(error.message);
    if (initial?.id) loadDocs(initial.id);
  };

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, third_party_details: thirdParties, created_by: u.user?.id };
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit claim" : "New claim"}</DialogTitle></DialogHeader>
        <div className="flex gap-1 border-b mb-2">
          {(["incident", "thirdparty", "documents"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t === "thirdparty" ? "Third parties" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab === "incident" && (
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
          <div className="space-y-1.5 sm:col-span-2"><Label>Accident statement (driver narrative)</Label><Textarea rows={4} value={form.accident_statement ?? ""} onChange={(e) => set("accident_statement", e.target.value)} placeholder="What happened, in the driver's own words…" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        )}
        {tab === "thirdparty" && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Capture any other vehicles or parties involved in the incident.</div>
            {thirdParties.length === 0 && <div className="text-sm text-muted-foreground italic">No third parties added.</div>}
            {thirdParties.map((tp, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/20">
                <div className="flex justify-between items-center">
                  <div className="font-medium text-sm">Party #{i + 1}</div>
                  <Button size="sm" variant="ghost" onClick={() => setThirdParties((arr) => arr.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input placeholder="Driver name" value={tp.name ?? ""} onChange={(e) => setThirdParties((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <Input placeholder="Phone" value={tp.phone ?? ""} onChange={(e) => setThirdParties((arr) => arr.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
                  <Input placeholder="Vehicle reg" value={tp.registration ?? ""} onChange={(e) => setThirdParties((arr) => arr.map((x, j) => j === i ? { ...x, registration: e.target.value } : x))} />
                  <Input placeholder="Insurer" value={tp.insurer ?? ""} onChange={(e) => setThirdParties((arr) => arr.map((x, j) => j === i ? { ...x, insurer: e.target.value } : x))} />
                  <Input placeholder="Policy no" value={tp.policy_no ?? ""} onChange={(e) => setThirdParties((arr) => arr.map((x, j) => j === i ? { ...x, policy_no: e.target.value } : x))} />
                  <Input placeholder="Damage description" value={tp.damage ?? ""} onChange={(e) => setThirdParties((arr) => arr.map((x, j) => j === i ? { ...x, damage: e.target.value } : x))} />
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setThirdParties((arr) => [...arr, {}])}><Plus className="h-4 w-4 mr-1" /> Add third party</Button>
          </div>
        )}
        {tab === "documents" && (
          <div className="space-y-4">
            {!initial?.id && (
              <div className="text-sm text-amber-600">Save the claim first, then attach documents.</div>
            )}
            {(["abstract", "driver_license", "national_id", "sketch", "other"] as const).map((folder) => (
              <div key={folder} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm capitalize">{folder.replace("_", " ")}</div>
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" disabled={!initial?.id || uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(folder, f); e.currentTarget.value = ""; }} />
                    <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Upload className="h-3.5 w-3.5" /> Upload</span>
                  </label>
                </div>
                <div className="space-y-1">
                  {docs.filter((d) => d.folder === folder).length === 0 && <div className="text-xs text-muted-foreground italic">No files.</div>}
                  {docs.filter((d) => d.folder === folder).map((d) => (
                    <div key={d.path} className="flex items-center justify-between text-sm">
                      <a href={d.url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline truncate">
                        <FileText className="h-3.5 w-3.5" /> {d.name}
                      </a>
                      <Button size="sm" variant="ghost" onClick={() => removeDoc(d.path)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.claim_no || !form.client_id}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}