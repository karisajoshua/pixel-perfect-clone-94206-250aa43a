import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyClaims, listMyPolicies, reportClaim } from "@/lib/portal.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/claims")({ component: Page });

function Page() {
  const list = useServerFn(listMyClaims);
  const policiesFn = useServerFn(listMyPolicies);
  const submitFn = useServerFn(reportClaim);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portal-claims"], queryFn: () => list(), staleTime: 60_000 });
  const { data: policies } = useQuery({ queryKey: ["portal-policies"], queryFn: () => policiesFn(), staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ policy_id: "", incident_date: "", incident_location: "", description: "", claim_amount: "" });
  const m = useMutation({
    mutationFn: () => submitFn({ data: {
      policy_id: form.policy_id || null,
      vehicle_id: (policies as any[] | undefined)?.find((p: any) => p.id === form.policy_id)?.vehicle_id || null,
      incident_date: form.incident_date,
      incident_location: form.incident_location || null,
      description: form.description,
      claim_amount: form.claim_amount ? Number(form.claim_amount) : null,
    } }),
    onSuccess: () => {
      toast.success("Claim reported. We'll be in touch shortly.");
      qc.invalidateQueries({ queryKey: ["portal-claims"] });
      setOpen(false);
      setForm({ policy_id: "", incident_date: "", incident_location: "", description: "", claim_amount: "" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to report claim"),
  });

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Claims</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Report a claim</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Report a claim</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
              <div>
                <Label>Policy</Label>
                <Select value={form.policy_id} onValueChange={(v) => setForm((f) => ({ ...f, policy_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a policy" /></SelectTrigger>
                  <SelectContent>{((policies as any[]) ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.policy_no} {p.vehicles?.registration_no ? `· ${p.vehicles.registration_no}` : ""}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div><Label>Incident date</Label><Input type="date" required value={form.incident_date} onChange={(e) => setForm((f) => ({ ...f, incident_date: e.target.value }))} /></div>
              <div><Label>Location</Label><Input value={form.incident_location} onChange={(e) => setForm((f) => ({ ...f, incident_location: e.target.value }))} /></div>
              <div><Label>Estimated amount (KES)</Label><Input type="number" value={form.claim_amount} onChange={(e) => setForm((f) => ({ ...f, claim_amount: e.target.value }))} /></div>
              <div><Label>What happened?</Label><Textarea required rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              <DialogFooter><Button type="submit" disabled={m.isPending}>{m.isPending ? "Submitting…" : "Submit claim"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-8 text-muted-foreground">Loading…</div> :
          !data || data.length === 0 ? <div className="p-12 text-center text-muted-foreground">No claims reported yet.</div> :
          <ul className="divide-y">{data.map((c: any) => (
            <li key={c.id} className="p-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{c.claim_no} <Badge variant="secondary" className="ml-2">{c.status}</Badge></div>
                <div className="text-xs text-muted-foreground mt-1">{c.incident_date} {c.incident_location ? `· ${c.incident_location}` : ""} {c.policies?.policy_no ? `· ${c.policies.policy_no}` : ""}</div>
                <div className="text-sm mt-2 text-foreground/80 line-clamp-2">{c.description}</div>
              </div>
              <div className="text-right text-sm">{c.claim_amount ? Number(c.claim_amount).toLocaleString() : ""}{c.settled_amount ? <div className="text-emerald-600 text-xs">Settled {Number(c.settled_amount).toLocaleString()}</div> : null}</div>
            </li>
          ))}</ul>
        }
      </CardContent></Card>
    </div>
  );
}