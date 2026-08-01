import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, ArrowRightLeft, Car } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { VehicleFormDialog } from "@/components/vehicles/vehicle-form-dialog";
import { TransferOwnershipDialog } from "@/components/vehicles/transfer-ownership-dialog";
import { useMyRoles } from "@/hooks/use-auth";

const TERMS: Record<string, string> = {
  tor: "One month (TOR)",
  one_month: "One month (TOR)",
  one_month_extendable: "One month extendable",
  six_months: "6 months",
  annual: "Annual",
};
const termLabel = (t?: string | null) => (t ? TERMS[t] ?? t.replace(/_/g, " ") : "—");
const money = (v: any) => (v === null || v === undefined || v === "" ? null : `KES ${Number(v).toLocaleString()}`);

export function ClientVehicles({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const canTransfer = !!roles?.some((r) => r === "admin" || r === "manager");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [transferVehicle, setTransferVehicle] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["client-vehicles", clientId],
    queryFn: async () => {
      const { data: vehicles, error } = await supabase
        .from("vehicles")
        .select("*, policies(id, policy_no, certificate_no, start_date, end_date, status, payment_status, policy_term, balance_due, cancelled_at, cancellation_reason, premium_gross, insurers(name))")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const policyIds = (vehicles ?? []).flatMap((v: any) => (v.policies ?? []).map((p: any) => p.id));
      let extensions: any[] = [];
      if (policyIds.length) {
        const { data: ext } = await supabase
          .from("policy_payment_extensions")
          .select("id, policy_id, amount_due, due_date, status, reason, paid_at")
          .in("policy_id", policyIds)
          .order("due_date");
        extensions = ext ?? [];
      }
      return { vehicles: vehicles ?? [], extensions };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-vehicles", clientId] });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading vehicles…</div>;

  const vehicles = data?.vehicles ?? [];
  const extensions = data?.extensions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New vehicle</Button>
      </div>

      {vehicles.length === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No vehicles on file for this client.</CardContent></Card>
      )}

      {vehicles.map((v: any) => {
        const policies = [...(v.policies ?? [])].sort((a: any, b: any) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
        return (
          <Card key={v.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-mono">
                  <Car className="h-4 w-4 text-muted-foreground" /> {v.registration_no}
                  {!v.active && <Badge variant="secondary">Inactive</Badge>}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {[v.make, v.model, v.year].filter(Boolean).join(" ") || "—"} • {v.usage_type ?? "—"}
                </p>
              </div>
              <div className="flex gap-1">
                {canTransfer && (
                  <Button size="sm" variant="ghost" title="Transfer ownership"
                    onClick={() => setTransferVehicle({ id: v.id, registration_no: v.registration_no, client_id: v.client_id })}>
                    <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setEdit(v); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                <D label="Chassis no." value={v.chassis_no} />
                <D label="Engine no." value={v.engine_no} />
                <D label="Body type" value={v.body_type} />
                <D label="Colour" value={v.color} />
                <D label="Fuel" value={v.fuel_type} />
                <D label="Seating" value={v.seating_capacity} />
                <D label="Cubic capacity" value={v.cubic_capacity} />
                <D label="Estimated value" value={money(v.estimated_value)} />
                <D label="Inspection due" value={v.inspection_due} />
                <D label="Next inspection" value={v.next_inspection_date} />
              </dl>

              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Cover</div>
                {policies.length === 0 && <p className="text-sm text-muted-foreground">No cover on record.</p>}
                {policies.map((p: any) => {
                  const exts = extensions.filter((e) => e.policy_id === p.id);
                  const cancelled = p.status === "cancelled";
                  return (
                    <div key={p.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-mono font-medium">{p.policy_no}</span>
                          <span className="text-muted-foreground"> • {p.insurers?.name ?? "No insurer"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={cancelled ? "destructive" : p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                          <Button asChild size="sm" variant="ghost"><Link to="/policies/$id" params={{ id: p.id }}>Open</Link></Button>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                        <D label="Certificate no." value={p.certificate_no} mono />
                        <D label="Commencing" value={p.start_date} />
                        <D label="Expiry" value={p.end_date} />
                        <D label="Term" value={termLabel(p.policy_term)} />
                        <D label="Premium" value={money(p.premium_gross)} />
                        <D label="Payment" value={p.payment_status} />
                        <D label="Balance due" value={money(p.balance_due)} />
                      </dl>
                      {cancelled && (
                        <div className="text-sm text-destructive">
                          Cancelled {p.cancelled_at ? new Date(p.cancelled_at).toLocaleDateString() : ""}
                          {p.cancellation_reason ? ` — ${p.cancellation_reason}` : ""}
                        </div>
                      )}
                      {exts.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">Payment extensions</div>
                          {exts.map((e) => {
                            const overdue = e.status !== "paid" && e.due_date && new Date(e.due_date) < new Date();
                            return (
                              <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-medium">{money(e.amount_due)}</span>
                                <span className="text-muted-foreground">due {e.due_date}</span>
                                <Badge variant={e.status === "paid" ? "secondary" : overdue ? "destructive" : "outline"}>
                                  {e.status === "paid" ? "paid" : overdue ? "overdue" : e.status}
                                </Badge>
                                {e.reason && <span className="text-muted-foreground">— {e.reason}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <VehicleFormDialog open={open} onOpenChange={setOpen} initial={edit} defaultClientId={clientId} onSaved={refresh} />
      <TransferOwnershipDialog
        open={!!transferVehicle}
        onOpenChange={(o) => { if (!o) setTransferVehicle(null); }}
        vehicle={transferVehicle}
        onDone={refresh}
      />
    </div>
  );
}

function D({ label, value, mono }: { label: string; value?: any; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 ${mono ? "font-mono" : ""}`}>{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}