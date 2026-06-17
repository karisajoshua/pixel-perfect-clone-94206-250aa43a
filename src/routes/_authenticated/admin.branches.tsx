import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/branches")({ component: Branches });

function Branches() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Delete this branch?")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["branches"] });
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Branches" subtitle="Offices in your agency network."
        actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New branch</Button>} />
      <Card>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th></th></tr>
          </thead>
          <tbody>
            {data?.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No branches yet.</td></tr>}
            {data?.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3">{b.code ?? "—"}</td>
                <td className="px-4 py-3">{b.email ?? "—"}</td>
                <td className="px-4 py-3">{b.phone ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEdit(b); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <BranchDialog open={open} onOpenChange={setOpen} initial={edit} onSaved={() => qc.invalidateQueries({ queryKey: ["branches"] })} />
    </div>
  );
}

function BranchDialog({ open, onOpenChange, initial, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  if (open && !form.name && initial) setForm(initial);
  if (!open && Object.keys(form).length) setTimeout(() => setForm({}), 0);

  const submit = async () => {
    setSaving(true);
    const op = initial?.id ? supabase.from("branches").update(form).eq("id", initial.id) : supabase.from("branches").insert(form);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved?.(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? "Edit branch" : "New branch"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Code</Label><Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.name}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}