import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, ArrowRightLeft, Car, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { VehicleFormDialog } from "@/components/vehicles/vehicle-form-dialog";
import { TransferOwnershipDialog } from "@/components/vehicles/transfer-ownership-dialog";
import { useMyRoles } from "@/hooks/use-auth";
import { VehicleDocuments, useVehicleDocuments, vehicleDocsBadge } from "@/components/clients/vehicle-documents";
import { dmvicConnectionStatus, dmvicVehicleSearch } from "@/lib/dmvic/dmvic.functions";
import { policyBalance, balanceLabel, formatKES, isCoverActive, coverLabel } from "@/lib/policy-balance";

const TERMS: Record<string, string> = {
  tor: "One month (TOR)",
  one_month: "One month (TOR)",
  one_month_extendable: "One month extendable",
  second_installment: "2nd installment",
  rop: "Rest of period (ROP)",
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
  const [dmvicVehicle, setDmvicVehicle] = useState<any>(null);
  const dmvicStatusFn = useServerFn(dmvicConnectionStatus);
  const dmvicVehicleSearchFn = useServerFn(dmvicVehicleSearch);
  const [vehicleSearchBusy, setVehicleSearchBusy] = useState(false);
  const [vehicleSearchResult, setVehicleSearchResult] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [dmvicForm, setDmvicForm] = useState({ memberCompanyId: "", certificateTypeCode: "1", coverCode: "200", policyholder: "", policyNumber: "", commencementDate: "", expiryDate: "", phoneNumber: "", email: "", insuredPin: "", sumInsured: "" });
  const { data: dmvicStatus, isLoading: dmvicStatusLoading } = useQuery({
    queryKey: ["dmvic-status"],
    queryFn: () => dmvicStatusFn(),
    retry: false,
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["client-vehicles", clientId],
    queryFn: async () => {
      const { data: vehicles, error } = await supabase
        .from("vehicles")
        .select("*, policies(id, policy_no, certificate_no, start_date, end_date, status, payment_status, policy_term, balance_due, cancelled_at, cancellation_reason, premium_gross, rop_of_policy_id, previous_policy_id, insurers(name))")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const allPolicies = (vehicles ?? []).flatMap((v: any) => (v.policies ?? []));
      const policyIds = allPolicies.map((p: any) => p.id);
      let extensions: any[] = [];
      const paidByPolicy: Record<string, number> = {};
      if (policyIds.length) {
        const { data: ext } = await supabase
          .from("policy_payment_extensions")
          .select("id, policy_id, amount_due, due_date, status, reason, paid_at")
          .in("policy_id", policyIds)
          .order("due_date");
        extensions = ext ?? [];
        const { data: invs } = await supabase
          .from("invoices")
          .select("policy_id, amount_paid")
          .in("policy_id", policyIds);

        // Group covers into instalment chains so a payment made on the first
        // invoice shows on every cover in the chain.
        const INSTALLMENT_TERMS = ["second_installment", "rop"];
        const parentOf = (row: any): string | null =>
          row?.rop_of_policy_id ?? (INSTALLMENT_TERMS.includes(String(row?.policy_term)) ? row?.previous_policy_id ?? null : null);
        const rootOf = (pid: string) => {
          let cur = pid;
          for (let i = 0; i < 6; i++) {
            const parent = parentOf(allPolicies.find((x: any) => x.id === cur));
            if (!parent || parent === cur || !allPolicies.some((x: any) => x.id === parent)) break;
            cur = parent;
          }
          return cur;
        };

        const paidByRoot: Record<string, number> = {};
        for (const i of invs ?? []) {
          if (!i.policy_id) continue;
          const root = rootOf(i.policy_id);
          paidByRoot[root] = (paidByRoot[root] ?? 0) + Number(i.amount_paid ?? 0);
        }
        for (const p of allPolicies) {
          paidByPolicy[p.id] = paidByRoot[rootOf(p.id)] ?? 0;
        }
      }
      return { vehicles: vehicles ?? [], extensions, paidByPolicy };

    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-vehicles", clientId] });

  const vehicleIds = (data?.vehicles ?? []).map((v: any) => v.id);
  const docsKey = ["vehicle-kyc", vehicleIds.join(",")];
  const { data: docs } = useVehicleDocuments(vehicleIds);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading vehicles…</div>;

  const vehicles = data?.vehicles ?? [];
  const extensions = data?.extensions ?? [];
  const paidByPolicy = data?.paidByPolicy ?? {};

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
        const active = policies.find((p: any) => isCoverActive(p));
        const shown = active ?? policies.find((p: any) => p.status !== "cancelled") ?? policies[0];
        const docItems = docs?.groups?.find((g: any) => g.vehicle_id === v.id)?.items;
        return (
          <Card key={v.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-mono">
                  <Car className="h-4 w-4 text-muted-foreground" /> {v.registration_no}
                  {!v.active && <Badge variant="secondary">Inactive</Badge>}
                  {vehicleDocsBadge(docItems)}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {[v.make, v.model, v.year].filter(Boolean).join(" ") || "—"} • {v.usage_type ?? "—"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" title="DMVIC motor certificate" onClick={() => setDmvicVehicle(v)}>
                  <ShieldCheck className="h-4 w-4 mr-1" /> DMVIC
                </Button>
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
              <div className="rounded-md border bg-muted/30 p-3">
                {shown ? (() => {
                  const shownBal = policyBalance(shown, paidByPolicy[shown.id] ?? null);
                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          {active ? "Active cover" : `Latest cover (${coverLabel(shown).label})`}
                        </div>
                        {!shownBal.unknown && shownBal.outstanding && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            Installment balance {formatKES(shownBal.balance)}
                          </Badge>
                        )}
                      </div>
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                        <D label="Policy no." value={shown.policy_no} mono />
                        <D label="Certificate no." value={shown.certificate_no} mono />
                        <D label="Commencing" value={shown.start_date} />
                        <D label="Expiry" value={shown.end_date} />
                        <D label="Premium" value={money(shown.premium_gross)} />
                        <D label="Paid" value={shownBal.unknown ? null : formatKES(shownBal.paid)} />
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Balance due</dt>
                          <dd className={`mt-0.5 ${shownBal.outstanding ? "text-destructive font-medium" : ""} ${shownBal.unknown ? "text-muted-foreground" : ""}`}>
                            {balanceLabel(shownBal)}
                          </dd>
                        </div>
                      </dl>
                      {!shownBal.unknown && (
                        <div className={`mt-2 text-xs font-medium ${shownBal.outstanding ? "text-destructive" : "text-emerald-600"}`}>
                          {shownBal.outstanding
                            ? `Paid ${formatKES(shownBal.paid)} of ${formatKES(shownBal.annual)} · balance ${formatKES(shownBal.balance)}`
                            : `Paid in full · ${formatKES(shownBal.annual)}`}
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">No active cover on record.</span>
                    <Button size="sm" variant="outline" onClick={() => { setEdit(v); setOpen(true); }}>Add cover</Button>
                  </div>
                )}
              </div>

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
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Documents (KYC)</div>
                {docItems
                  ? <VehicleDocuments clientId={clientId} vehicleId={v.id} items={docItems} queryKey={docsKey} />
                  : <p className="text-sm text-muted-foreground">Loading documents…</p>}
              </div>

              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Cover</div>
                {policies.length === 0 && <p className="text-sm text-muted-foreground">No cover on record.</p>}
                {policies.map((p: any) => {
                  const exts = extensions.filter((e) => e.policy_id === p.id);
                  const cancelled = p.status === "cancelled";
                  const bal = policyBalance(p, paidByPolicy[p.id] ?? null);
                  return (
                    <div key={p.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-mono font-medium">{p.policy_no}</span>
                          <span className="text-muted-foreground"> • {p.insurers?.name ?? "No insurer"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={cancelled ? "destructive" : coverLabel(p).tone === "active" ? "default" : "secondary"}>{coverLabel(p).label}</Badge>
                          <Button asChild size="sm" variant="ghost"><Link to="/policies/$id" params={{ id: p.id }}>Open</Link></Button>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                        <D label="Certificate no." value={p.certificate_no} mono />
                        <D label="Commencing" value={p.start_date} />
                        <D label="Expiry" value={p.end_date} />
                        <D label="Term" value={termLabel(p.policy_term)} />
                        <D label="Premium" value={money(p.premium_gross)} />
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Payment</dt>
                          <dd className="mt-0.5 flex flex-wrap items-center gap-1">
                            {p.payment_status || <span className="text-muted-foreground">—</span>}
                            {bal.mismatch && (
                              <span className="text-xs text-amber-600" title="Stored payment status disagrees with the figures — record or reconcile the payment">(status out of sync)</span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Balance due</dt>
                          <dd className={`mt-0.5 ${bal.outstanding ? "text-destructive font-medium" : ""} ${bal.unknown ? "text-muted-foreground" : ""}`}>
                            {balanceLabel(bal)}
                          </dd>
                        </div>
                        <D label="Paid" value={bal.unknown ? null : formatKES(bal.paid)} />
                      </dl>
                      {!bal.unknown && (
                        <div className={`text-xs font-medium ${bal.outstanding ? "text-destructive" : "text-emerald-600"}`}>
                          {bal.outstanding
                            ? `Paid ${formatKES(bal.paid)} of ${formatKES(bal.annual)} · balance ${formatKES(bal.balance)}`
                            : `Paid in full · ${formatKES(bal.annual)}`}
                        </div>
                      )}
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

      {dmvicVehicle && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2"><ShieldCheck className="h-5 w-5" /> DMVIC · {dmvicVehicle.registration_no} {dmvicStatusLoading ? <Badge variant="outline">Checking UAT…</Badge> : dmvicStatus?.configured ? <Badge variant="secondary">UAT ready</Badge> : <Badge variant="destructive">UAT unavailable</Badge>}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">DMVIC certificate operations for this vehicle. DMVIC operations use DMVIC's own API contracts.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!dmvicStatus?.configured || vehicleSearchBusy} onClick={async()=>{setVehicleSearchBusy(true);setVehicleSearchResult(null);try{const res=await dmvicVehicleSearchFn({data:{VehicleRegistrationNumber:String(dmvicVehicle.registration_no||"").trim()}});setVehicleSearchResult(res);if(res.ok) toast.success("DMVIC vehicle and insurance check completed");else toast.error(res.error||"DMVIC vehicle check needs review");}catch(e:any){toast.error(e?.message||"DMVIC vehicle check failed");}finally{setVehicleSearchBusy(false);}}}>{vehicleSearchBusy?"Checking…":"Check vehicle & insurance"}</Button>
              <Button variant="ghost" onClick={() => setDmvicVehicle(null)}>Close</Button>
            </div>
            {vehicleSearchResult && <div className="rounded-md border p-3 space-y-2"><div className="font-medium">{vehicleSearchResult.ok?"DMVIC vehicle record":"DMVIC check needs attention"}</div>{vehicleSearchResult.error&&<div className="text-destructive">{vehicleSearchResult.error}</div>}<pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(vehicleSearchResult.data??{},null,2)}</pre></div>}
            <p className="text-xs text-muted-foreground">This check uses DMVIC Vehicle Search only. Vehicle information and policy history returned by DMVIC are shown without a separate NTSA integration.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>DMVIC Type A certificate preview</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Existing Zest client, policy and vehicle data is prefilled. DMVIC identifiers remain DMVIC-native and must be entered from verified DMVIC data.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="DMVIC Member Company ID" value={dmvicForm.memberCompanyId} set={(v) => setDmvicForm(x => ({...x, memberCompanyId:v}))} />
            <div className="space-y-1"><Label>Certificate type</Label><Select value={dmvicForm.certificateTypeCode} onValueChange={(v)=>setDmvicForm(x=>({...x,certificateTypeCode:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Type A</SelectItem><SelectItem value="8">Type A Tax</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label>DMVIC cover code</Label><Select value={dmvicForm.coverCode} onValueChange={(v)=>setDmvicForm(x=>({...x,coverCode:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="100">100</SelectItem><SelectItem value="200">200</SelectItem><SelectItem value="300">300</SelectItem></SelectContent></Select></div>
            <Field label="Policyholder" value={dmvicForm.policyholder} set={(v) => setDmvicForm(x => ({...x, policyholder:v}))} />
            <Field label="Policy number" value={dmvicForm.policyNumber} set={(v) => setDmvicForm(x => ({...x, policyNumber:v}))} />
            <Field label="Commencing date" type="date" value={dmvicForm.commencementDate} set={(v) => setDmvicForm(x => ({...x, commencementDate:v}))} />
            <Field label="Expiry date" type="date" value={dmvicForm.expiryDate} set={(v) => setDmvicForm(x => ({...x, expiryDate:v}))} />
            <Field label="Phone" value={dmvicForm.phoneNumber} set={(v) => setDmvicForm(x => ({...x, phoneNumber:v}))} />
            <Field label="Email" value={dmvicForm.email} set={(v) => setDmvicForm(x => ({...x, email:v}))} />
            <Field label="Insured KRA PIN" value={dmvicForm.insuredPin} set={(v) => setDmvicForm(x => ({...x, insuredPin:v}))} />
            <Field label="Sum insured" type="number" value={dmvicForm.sumInsured} set={(v) => setDmvicForm(x => ({...x, sumInsured:v}))} />
          </div>
          {previewResult && <div className="rounded-md border p-3 text-sm"><div className="font-medium">{previewResult.ok ? "DMVIC preview successful" : "DMVIC preview returned an issue"}</div><div className="text-muted-foreground mt-1">{previewResult.error || previewResult.issuanceMessage || (previewResult.ok ? "The request was accepted by DMVIC UAT for preview." : "Review the DMVIC response and entered data.")}</div></div>}
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setPreviewOpen(false)}>Close</Button>
            <Button disabled={previewBusy || !dmvicForm.memberCompanyId} onClick={async()=>{
              setPreviewBusy(true); setPreviewResult(null);
              try {
                const payload:any = { memberCompanyId: dmvicForm.memberCompanyId, certificateTypeCode:Number(dmvicForm.certificateTypeCode), coverCode:Number(dmvicForm.coverCode), policyholder:dmvicForm.policyholder, policyNumber:dmvicForm.policyNumber, commencementDate:dmvicForm.commencementDate, expiryDate:dmvicForm.expiryDate, registrationNumber:dmvicVehicle.registration_no || undefined, chassisNumber:dmvicVehicle.chassis_no || "", phoneNumber:dmvicForm.phoneNumber, bodyType:dmvicVehicle.body_type || "", licensedToCarry:Number(dmvicVehicle.seating_capacity || 1), vehicleMake:dmvicVehicle.make || undefined, vehicleModel:dmvicVehicle.model || undefined, engineNumber:dmvicVehicle.engine_no || undefined, email:dmvicForm.email, insuredPin:dmvicForm.insuredPin, yearOfManufacture:dmvicVehicle.year ? Number(dmvicVehicle.year) : undefined };
                if (dmvicForm.sumInsured) payload.sumInsured=Number(dmvicForm.sumInsured);
                const res=await dmvicPreviewFn({data:payload}); setPreviewResult(res);
                if(res.ok) toast.success("DMVIC UAT preview completed"); else toast.error(res.error || "DMVIC preview needs review");
              } catch(e:any){ toast.error(e?.message || "Could not preview DMVIC certificate"); }
              finally{setPreviewBusy(false);}
            }}>{previewBusy ? "Previewing…" : "Preview in DMVIC UAT"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function Field({ label, value, set, type = "text" }: { label: string; value: string; set: (v: string) => void; type?: string }) {
  return <div className="space-y-1"><Label>{label}</Label><Input type={type} value={value} onChange={(e)=>set(e.target.value)} /></div>;
}
