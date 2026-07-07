import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, RefreshCw, Ban } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PolicyFormDialog } from "@/components/policies/policy-form-dialog";
import { IpenPolicyLiveDrawer } from "@/components/ipen/policy-live-drawer";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/policies/$id")({ beforeLoad: requireRole(["admin", "manager", "agent"]), component: PolicyDetail });

function PolicyDetail() {
  const { id } = useParams({ from: "/_authenticated/policies/$id" });
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [renew, setRenew] = useState(false);
  const [ipenOpen, setIpenOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["policy", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*, clients(id, full_name, company_name, client_type), insurers(name), vehicles(registration_no, make, model)")
        .eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!p) return <div className="p-8">Not found</div>;

  const clientName = p.clients?.client_type === "corporate" ? p.clients?.company_name ?? p.clients?.full_name : p.clients?.full_name;

  const markRenewed = async () => {
    const { error } = await supabase.from("policies").update({ status: "renewed" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as renewed");
    qc.invalidateQueries({ queryKey: ["policy", id] });
    qc.invalidateQueries({ queryKey: ["policies"] });
  };

  const submitCancel = async () => {
    const reason = cancelReason.trim();
    if (!reason) return toast.error("Please provide a reason for cancellation");
    setCancelling(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("policies").update({
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      cancelled_by: u.user?.id ?? null,
    } as any).eq("id", id);
    setCancelling(false);
    if (error) return toast.error(error.message);
    toast.success("Policy cancelled");
    setCancelOpen(false); setCancelReason("");
    qc.invalidateQueries({ queryKey: ["policy", id] });
    qc.invalidateQueries({ queryKey: ["policies"] });
    qc.invalidateQueries({ queryKey: ["dashboard", "summary"] });
  };

  return (
    <div className="p-8 space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/policies"><ArrowLeft className="h-4 w-4 mr-1" /> All policies</Link></Button>
      <PageHeader
        title={p.policy_no}
        subtitle={`${clientName} • ${p.product_class} • ${p.cover_type}`}
        actions={
          <div className="flex gap-2">
            {p.ipen_policy_id && (
              <>
                <Badge variant="secondary" className="self-center">IPEN</Badge>
                <Button variant="outline" onClick={() => setIpenOpen(true)}>View live IPEN details</Button>
              </>
            )}
            {p.status !== "cancelled" && (
              <Button variant="outline" onClick={() => setCancelOpen(true)}><Ban className="h-4 w-4 mr-1" /> Cancel policy</Button>
            )}
            <Button variant="outline" onClick={() => setRenew(true)}><RefreshCw className="h-4 w-4 mr-1" /> Renew</Button>
            <Button onClick={() => setEdit(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          </div>
        }
      />

      {p.status === "cancelled" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader><CardTitle className="text-destructive text-base">Policy cancelled</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Cancelled on:</span> {p.cancelled_at ? new Date(p.cancelled_at).toLocaleString() : "—"}</div>
            <div><span className="text-muted-foreground">Reason:</span> {p.cancellation_reason || "—"}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Policy details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Item label="Insurer" value={p.insurers?.name} />
              <Item label="Vehicle" value={p.vehicles?.registration_no ? `${p.vehicles.registration_no} (${[p.vehicles.make, p.vehicles.model].filter(Boolean).join(" ")})` : "—"} />
              <Item label="Start" value={p.start_date} />
              <Item label="End" value={p.end_date} />
              <Item label="Sum insured" value={p.sum_insured ? `KES ${Number(p.sum_insured).toLocaleString()}` : "—"} />
              <Item label="Gross premium" value={p.premium_gross ? `KES ${Number(p.premium_gross).toLocaleString()}` : "—"} />
              <Item label="Net premium" value={p.premium_net ? `KES ${Number(p.premium_net).toLocaleString()}` : "—"} />
              <Item label="Commission" value={p.commission ? `KES ${Number(p.commission).toLocaleString()}` : "—"} />
              <Item label="Taxes" value={p.taxes ? `KES ${Number(p.taxes).toLocaleString()}` : "—"} />
              <Item label="Status" value={p.status} />
              <Item label="Payment" value={p.payment_status} />
              <div className="col-span-2"><Item label="Notes" value={p.notes} /></div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Client</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium">{clientName}</div>
            <Button asChild variant="outline" size="sm"><Link to="/clients/$id" params={{ id: p.client_id }}>Open client</Link></Button>
            {p.status !== "renewed" && (
              <Button variant="ghost" size="sm" className="w-full" onClick={markRenewed}>Mark as renewed</Button>
            )}
          </CardContent>
        </Card>
      </div>

      <PolicyFormDialog open={edit} onOpenChange={setEdit} initial={p} onSaved={() => qc.invalidateQueries({ queryKey: ["policy", id] })} />
      <PolicyFormDialog open={renew} onOpenChange={setRenew} renewFrom={p} onSaved={(newId) => {
        markRenewed();
        qc.invalidateQueries({ queryKey: ["policies"] });
        if (newId) toast.success("Renewal policy created");
      }} />
      {p.ipen_policy_id && (
        <IpenPolicyLiveDrawer open={ipenOpen} onOpenChange={setIpenOpen} ipenPolicyId={String(p.ipen_policy_id)} />
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel policy</DialogTitle>
            <DialogDescription>This marks the policy as cancelled. Please give a reason — it will be recorded and shown on the dashboard.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation…" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Back</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={cancelling || !cancelReason.trim()}>{cancelling ? "Cancelling…" : "Confirm cancellation"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}