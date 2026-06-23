import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/insurers")({ beforeLoad: requireRole(["admin"]), component: Insurers });

function Insurers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data } = useQuery({
    queryKey: ["insurers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("insurers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Delete this insurer?")) return;
    const { error } = await supabase.from("insurers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["insurers"] });
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Insurers" subtitle="Insurance companies you place business with."
        actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New insurer</Button>} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Status</th><th></th></tr>
            </thead>
            <tbody>
              {data?.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No insurers yet.</td></tr>}
              {data?.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex flex-col gap-2">
                      <span>{i.name}</span>
                      {i.logo_url ? (
                        <img src={i.logo_url} alt={`${i.name} logo`} className="h-10 w-auto object-contain" />
                      ) : (
                        <span className="text-xs text-muted-foreground">{i.name?.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{i.short_code ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div>{i.contact_email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{i.contact_phone ?? ""}</div>
                  </td>
                  <td className="px-4 py-3"><Badge variant={i.active ? "default" : "secondary"}>{i.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEdit(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <InsurerDialog open={open} onOpenChange={setOpen} initial={edit} onSaved={() => qc.invalidateQueries({ queryKey: ["insurers"] })} />
    </div>
  );
}

function InsurerDialog({ open, onOpenChange, initial, onSaved }: any) {
  const [form, setForm] = useState<any>({ active: true });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  useEffect(() => { if (open) setForm(initial ?? { active: true }); }, [open, initial]);

  const submit = async () => {
    setSaving(true);
    const op = initial?.id ? supabase.from("insurers").update(form).eq("id", initial.id) : supabase.from("insurers").insert(form);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved"); onSaved?.(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? "Edit insurer" : "New insurer"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Short code</Label><Input value={form.short_code ?? ""} onChange={(e) => set("short_code", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Logo URL</Label>
            <Input value={form.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://… or /__l5e/assets-v1/…" />
            {form.logo_url && (
              <img src={form.logo_url} alt="Logo preview" className="mt-2 h-12 w-auto object-contain" />
            )}
          </div>
          <div className="flex items-center gap-3"><Switch checked={!!form.active} onCheckedChange={(v) => set("active", v)} /><Label>Active</Label></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.name}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}