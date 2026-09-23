import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, RefreshCw, Ban, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { productClassLabel } from "@/lib/product-classes";
import { PolicyFormDialog } from "@/components/policies/policy-form-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { policyTermLabel } from "@/lib/utils";
import { policyBalance, balanceLabel, formatKES, coverLabel, COVER_TONE_CLASS } from "@/lib/policy-balance";
import { fetchChainInvoices, chainTotals } from "@/lib/policy-chain";
import { PaymentStatement } from "@/components/payments/payment-statement";

import {
  isInstallmentTerm, computeInstallmentSummary, buildNextCoverPayload,
  INSTALLMENT_PLAN_LABELS, type InstallmentPlan,
} from "@/lib/policy-installments";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Check as CheckIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { dmvicConnectionStatus, dmvicProcessZestCertificate } from "@/lib/dmvic/dmvic.functions";
import { dmvicPrepareCertificateOrder } from "@/lib/dmvic/certificate-orders.functions";

export const Route = createFileRoute("/_authenticated/policies/$id")({ beforeLoad: requireRole(["admin", "manager", "agent"]), component: PolicyDetail });

function PolicyDetail() {
  const { id } = useParams({ from: "/_authenticated/policies/$id" });
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [renew, setRenew] = useState(false);
  const [dmvicOpen, setDmvicOpen] = useState(false);
  const [dmvicBusy, setDmvicBusy] = useState(false);
  const [dmvicResult, setDmvicResult] = useState<any>(null);
  const [dmvicLastPayload, setDmvicLastPayload] = useState<any>(null);
  const [dmvicOrder, setDmvicOrder] = useState<any>(null);
  const [dmvicForm, setDmvicForm] = useState({ family: "A", certificateTypeCode: "1", vehicleType: "1", coverCode: "200", phoneNumber: "", email: "", insuredPin: "", bodyType: "", licensedToCarry: "1", tonnage: "1" });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [extOpen, setExtOpen] = useState(false);
  const [extForm, setExtForm] = useState<{ amount_due: string; due_date: string; reason: string }>({ amount_due: "", due_date: "", reason: "" });
  const [savingExt, setSavingExt] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const dmvicStatusFn = useServerFn(dmvicConnectionStatus);
  const dmvicProcessFn = useServerFn(dmvicProcessZestCertificate);
  const dmvicPrepareFn = useServerFn(dmvicPrepareCertificateOrder);

  const { data: p, isLoading } = useQuery({
    queryKey: ["policy", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*, clients(id, full_name, company_name, client_type, phone, email, kra_pin), insurers(name, dmvic_member_company_id), vehicles(registration_no, make, model, year, chassis_no, engine_no, body_type, seating_capacity, estimated_value)")
        .eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: latestCertificateOrder } = useQuery({
    queryKey: ["dmvic-certificate-order", id],
    enabled: !!id,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      return status === "awaiting_payment" || status === "paid" || status === "issuing" ? 5000 : false;
    },
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dmvic_certificate_orders")
        .select("id,status,payment_status,payment_reference,selling_price,dmvic_certificate_number,issued_at,updated_at")
        .eq("policy_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: extensions } = useQuery({
    queryKey: ["policy-extensions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policy_payment_extensions")
        .select("*")
        .eq("policy_id", id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Payments follow the whole instalment chain: the money is usually invoiced
  // once, on the first cover, but it settles every cover in the chain.
  const { data: chainInvoices } = useQuery({
    queryKey: ["policy-chain-invoices", id],
    queryFn: () => fetchChainInvoices(id),
  });
  const chainStats = chainTotals(chainInvoices ?? []);
  const paymentsAgg = chainStats.paid;
  const chainPayments = (chainInvoices ?? []).flatMap((i) =>
    i.payments.map((p) => ({ ...p, invoice_no: i.invoice_no })),
  );


  // Walk back the installment chain so the ROP always ends on the original anniversary.
  const { data: chainStart } = useQuery({
    queryKey: ["policy-chain-start", id],
    enabled: !!p?.id,
    queryFn: async () => {
      let start: string = p.start_date;
      let parent: string | null = p.rop_of_policy_id ?? null;
      for (let i = 0; i < 5 && parent; i++) {
        const { data } = await supabase.from("policies").select("start_date, rop_of_policy_id").eq("id", parent).maybeSingle();
        if (!data) break;
        start = (data as any).start_date;
        parent = (data as any).rop_of_policy_id ?? null;
      }
      return start;
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

  const submitExtension = async () => {
    const amount = Number(extForm.amount_due);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    if (!extForm.due_date) return toast.error("Pick a due date");
    setSavingExt(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("policy_payment_extensions").insert({
      policy_id: id,
      amount_due: amount,
      due_date: extForm.due_date,
      reason: extForm.reason || null,
      status: "pending",
      created_by: u.user?.id,
    } as any);
    setSavingExt(false);
    if (error) return toast.error(error.message);
    // shift policy payment_status to partial if not paid
    if (p.payment_status !== "paid") {
      await supabase.from("policies").update({ payment_status: "partial" }).eq("id", id);
    }
    toast.success("Extension added");
    setExtOpen(false);
    setExtForm({ amount_due: "", due_date: "", reason: "" });
    qc.invalidateQueries({ queryKey: ["policy-extensions", id] });
    qc.invalidateQueries({ queryKey: ["policy", id] });
    qc.invalidateQueries({ queryKey: ["dashboard", "summary"] });
  };

  const markExtensionPaid = async (extId: string) => {
    const { error } = await supabase.from("policy_payment_extensions")
      .update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", extId);
    if (error) return toast.error(error.message);
    toast.success("Marked paid");
    qc.invalidateQueries({ queryKey: ["policy-extensions", id] });
    qc.invalidateQueries({ queryKey: ["dashboard", "summary"] });
  };

  const deleteExtension = async (extId: string) => {
    if (!confirm("Delete this extension?")) return;
    const { error } = await supabase.from("policy_payment_extensions").delete().eq("id", extId);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["policy-extensions", id] });
    qc.invalidateQueries({ queryKey: ["dashboard", "summary"] });
  };

  const today = new Date().toISOString().slice(0, 10);
  const pendingExts = (extensions ?? []).filter((e) => e.status === "pending");
  const outstanding = pendingExts.reduce((s, e) => s + Number(e.amount_due ?? 0), 0);
  const overdueCount = pendingExts.filter((e) => e.due_date < today).length;
  const totalPaid = Number(paymentsAgg ?? 0);
  const gross = Number(p.premium_gross ?? 0);

  const onInstallmentPath = isInstallmentTerm(p.policy_term);
  const bal = policyBalance(p, totalPaid);
  const summary = computeInstallmentSummary({
    premiumGross: p.premium_gross,
    paid: totalPaid,
    plan: p.installment_plan,
    term: p.policy_term,
  });
  const nextIsRop = !(p.policy_term === "one_month_extendable" && p.installment_plan === "two_installments");

  const setPlan = async (plan: InstallmentPlan) => {
    const { error } = await supabase.from("policies").update({ installment_plan: plan } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment plan saved");
    qc.invalidateQueries({ queryKey: ["policy", id] });
  };

  const openExtension = () => {
    setExtForm({
      amount_due: summary.nextAmount ? String(summary.nextAmount) : "",
      due_date: p.end_date ?? "",
      reason: nextIsRop ? "Balance to clear before ROP" : "Second installment",
    });
    setExtOpen(true);
  };

  const issueNextCover = async () => {
    if (!summary.cleared && !confirm(`There is still a balance of KES ${summary.balance.toLocaleString()}. Issue the next cover anyway?`)) return;
    setIssuing(true);
    const { data: u } = await supabase.auth.getUser();
    let nextCover: ReturnType<typeof buildNextCoverPayload>;
    try {
      nextCover = buildNextCoverPayload({ ...p, installment_origin_start: chainStart ?? p.start_date }, summary);
    } catch (error) {
      setIssuing(false);
      return toast.error(error instanceof Error ? error.message : "Could not calculate the next cover dates");
    }
    const { term, payload } = nextCover;
    const suffix = term === "rop" ? "ROP" : "I2";
    let data: { id: string } | null = null;
    let error: any = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const policyNo = attempt === 1 ? `${p.policy_no}-${suffix}` : `${p.policy_no}-${suffix}-${attempt}`;
      const res = await supabase.from("policies").insert({
        ...payload,
        policy_no: policyNo,
        created_by: u.user?.id,
      } as any).select("id").single();
      data = res.data as any;
      error = res.error;
      if (!error) break;
      // 23505 = duplicate policy number; try the next suffix
      if ((error as any).code !== "23505") break;
    }
    setIssuing(false);
    if (error) return toast.error(error.message ?? "Could not create the next cover");
    toast.success(term === "rop" ? "ROP policy created" : "Second installment cover created");
    qc.invalidateQueries({ queryKey: ["policies"] });
    if (data?.id) window.location.href = `/policies/${data.id}`;
  };


  return (
    <div className="p-8 space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/policies"><ArrowLeft className="h-4 w-4 mr-1" /> All policies</Link></Button>
      <PageHeader
        title={p.policy_no}
        subtitle={`${clientName} • ${productClassLabel(p.product_class, p.product_subclass, p.tonnage)} • ${p.cover_type}`}
        actions={
          <div className="flex gap-2">
            <Badge variant="outline" className={`self-center ${COVER_TONE_CLASS[coverLabel(p).tone]}`}>
              {coverLabel(p).label === "active" ? "Cover active" : `Cover ${coverLabel(p).label}`}
            </Badge>
            {p.vehicles?.registration_no && (
              <Button variant="outline" onClick={() => { setDmvicResult(null); setDmvicOrder(null); setDmvicForm((x) => ({ ...x, phoneNumber: p.clients?.phone || "", email: p.clients?.email || "", insuredPin: p.clients?.kra_pin || "", bodyType: p.vehicles?.body_type || "", licensedToCarry: String(p.vehicles?.seating_capacity || 1) })); setDmvicOpen(true); }}><ShieldCheck className="h-4 w-4 mr-1" /> Certificate</Button>
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
              <Item label="Certificate no." value={p.certificate_no} />
              <Item label="Insurer" value={p.insurers?.name} />
              <Item label={p.vehicles?.registration_no ? "Vehicle" : "Risk"} value={p.vehicles?.registration_no ? `${p.vehicles.registration_no} (${[p.vehicles.make, p.vehicles.model].filter(Boolean).join(" ")})` : p.risk_label ?? "—"} />
              <Item label="Start" value={p.start_date} />
              <Item label="End" value={p.end_date} />
              <Item label="Sum insured" value={p.sum_insured ? `KES ${Number(p.sum_insured).toLocaleString()}` : "—"} />
              <Item label="Gross premium" value={p.premium_gross ? `KES ${Number(p.premium_gross).toLocaleString()}` : "—"} />
              <Item label="Net premium" value={p.premium_net ? `KES ${Number(p.premium_net).toLocaleString()}` : "—"} />
              <Item label="Commission" value={p.commission ? `KES ${Number(p.commission).toLocaleString()}` : "—"} />
              <Item label="Taxes" value={p.taxes ? `KES ${Number(p.taxes).toLocaleString()}` : "—"} />
              <Item label="Status" value={coverLabel(p).label} />
              <Item label="Payment" value={p.payment_status} />
              <Item label="Amount paid" value={formatKES(bal.paid)} />
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Balance due</dt>
                <dd className={`mt-0.5 ${bal.outstanding ? "text-destructive font-medium" : ""} ${bal.unknown ? "text-muted-foreground" : ""}`}>
                  {balanceLabel(bal)}
                </dd>
              </div>
              <Item label="Term" value={policyTermLabel(p.policy_term)} />
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

      {onInstallmentPath && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              Installment plan
              <Badge variant="secondary">{policyTermLabel(p.policy_term)}</Badge>
              {!summary.cleared && p.end_date <= today && <Badge variant="destructive">Installment due</Badge>}
            </CardTitle>
            <Button size="sm" onClick={issueNextCover} disabled={issuing}>
              {issuing ? "Creating…" : nextIsRop ? "Issue ROP policy" : "Issue 2nd installment cover"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {p.policy_term === "one_month_extendable" && (
              <div className="space-y-1.5 max-w-md">
                <Label>Payment plan</Label>
                <Select value={p.installment_plan ?? "clear_balance"} onValueChange={(v) => setPlan(v as InstallmentPlan)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clear_balance">{INSTALLMENT_PLAN_LABELS.clear_balance}</SelectItem>
                    <SelectItem value="two_installments">{INSTALLMENT_PLAN_LABELS.two_installments}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Annual premium" value={summary.annual ? `KES ${summary.annual.toLocaleString()}` : "—"} />
              <Stat label="Paid to date" value={`KES ${summary.paid.toLocaleString()}`} />
              <Stat label="Balance to clear" value={`KES ${summary.balance.toLocaleString()}`} tone={summary.balance > 0 ? "bad" : "good"} />
              <Stat label="Next installment" value={`KES ${summary.nextAmount.toLocaleString()}`} />
            </div>
            <p className="text-sm text-muted-foreground">
              {summary.cleared
                ? "Balance cleared — issue the Rest of Period cover to run to the annual anniversary."
                : nextIsRop
                  ? `Client clears KES ${summary.balance.toLocaleString()} by ${p.end_date}, then gets the Rest of Period running to the annual anniversary of ${chainStart ?? p.start_date}.`
                  : `Client pays KES ${summary.nextAmount.toLocaleString()} now for the 2nd month, then clears KES ${summary.afterNext.toLocaleString()} on the 3rd month to get the Rest of Period.`}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Every transaction billed against this cover and the instalment covers linked to it, with the balance after each payment.
          </p>
          <PaymentStatement
            payments={chainPayments}
            total={chainStats.billed || gross}
            showInvoice
            emptyText="No payments recorded against this cover yet."
          />
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            Payment extensions
            {overdueCount > 0 && <Badge variant="destructive">{overdueCount} overdue</Badge>}
          </CardTitle>
          <Button size="sm" onClick={openExtension}><Plus className="h-4 w-4 mr-1" /> Add extension</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-muted-foreground">Gross premium</div>
              <div className="text-lg font-semibold mt-1">{gross ? `KES ${gross.toLocaleString()}` : "—"}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-muted-foreground">Paid to date</div>
              <div className="text-lg font-semibold mt-1">KES {totalPaid.toLocaleString()}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-muted-foreground">Outstanding (extensions)</div>
              <div className={`text-lg font-semibold mt-1 ${outstanding > 0 ? "text-destructive" : ""}`}>KES {outstanding.toLocaleString()}</div>
            </div>
          </div>
          {(extensions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment extensions on this policy yet. Add one when a client needs more time to pay the balance.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Due date</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(extensions ?? []).map((e) => {
                    const overdue = e.status === "pending" && e.due_date < today;
                    return (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="px-3 py-2">KES {Number(e.amount_due).toLocaleString()}</td>
                        <td className="px-3 py-2">{e.due_date}</td>
                        <td className="px-3 py-2 max-w-md truncate" title={e.reason ?? ""}>{e.reason ?? "—"}</td>
                        <td className="px-3 py-2">
                          {e.status === "paid" ? (
                            <Badge variant="secondary">Paid</Badge>
                          ) : overdue ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <Badge>Pending</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {e.status === "pending" && (
                            <Button size="sm" variant="ghost" onClick={() => markExtensionPaid(e.id)}><CheckIcon className="h-3 w-3 mr-1" /> Mark paid</Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => deleteExtension(e.id)}><Trash2 className="h-3 w-3" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PolicyFormDialog open={edit} onOpenChange={setEdit} initial={p} onSaved={() => qc.invalidateQueries({ queryKey: ["policy", id] })} />
      <PolicyFormDialog open={renew} onOpenChange={setRenew} renewFrom={p} onSaved={(newId) => {
        markRenewed();
        qc.invalidateQueries({ queryKey: ["policies"] });
        if (newId) toast.success("Renewal policy created");
      }} />

      <Dialog open={dmvicOpen} onOpenChange={setDmvicOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pr-6">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg"><ShieldCheck className="h-5 w-5 shrink-0" /> <span className="break-words">Motor certificate</span></DialogTitle>
            <DialogDescription>Review the policy details and prepare the certificate. Provider validation and issuance are handled securely in the background.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Item label="Insured" value={clientName} />
            <Item label="Vehicle" value={p.vehicles?.registration_no} />
            <Item label="Policy no." value={p.policy_no} />
            <Item label="Underwriter" value={p.insurers?.name} />
            <Item label="Cover period" value={p.start_date && p.end_date ? `${p.start_date} — ${p.end_date}` : "—"} />
            <Item label="Premium" value={p.premium_gross ? `KES ${Number(p.premium_gross).toLocaleString()}` : "—"} />
          </div>

          <div className="rounded-md border p-3 sm:p-4 space-y-3 min-w-0">
            <div className="font-medium">Certificate details</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Vehicle / certificate category</Label><Select value={dmvicForm.family} onValueChange={(v)=>setDmvicForm(x=>({...x,family:v,certificateTypeCode:v==="D"?"4":"1"}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">PSV / Passenger Vehicles</SelectItem><SelectItem value="B">Commercial Vehicles</SelectItem><SelectItem value="C">Motor Certificate</SelectItem><SelectItem value="D">Motorcycles</SelectItem></SelectContent></Select></div>
              {dmvicForm.family==="A" && <div className="space-y-1.5"><Label>Associated category</Label><Select value={dmvicForm.certificateTypeCode} onValueChange={(v)=>setDmvicForm(x=>({...x,certificateTypeCode:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">PSV Unmarked</SelectItem><SelectItem value="6">Bus</SelectItem><SelectItem value="7">Matatu</SelectItem><SelectItem value="8">Taxi</SelectItem></SelectContent></Select></div>}
              {dmvicForm.family==="B" && <div className="space-y-1.5"><Label>Associated commercial category</Label><Select value={dmvicForm.vehicleType} onValueChange={(v)=>setDmvicForm(x=>({...x,vehicleType:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Own Goods</SelectItem><SelectItem value="2">General Cartage</SelectItem><SelectItem value="3">Institutional Vehicle</SelectItem><SelectItem value="4">Special Vehicle</SelectItem><SelectItem value="5">Tanker (Liquid Carrying)</SelectItem><SelectItem value="6">Motor Trade / Road Risk</SelectItem></SelectContent></Select></div>}
              {dmvicForm.family==="D" && <div className="space-y-1.5"><Label>Associated motorcycle category</Label><Select value={dmvicForm.certificateTypeCode} onValueChange={(v)=>setDmvicForm(x=>({...x,certificateTypeCode:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="4">Motorcycle</SelectItem><SelectItem value="9">PSV Motorcycle</SelectItem><SelectItem value="10">Commercial Motorcycle</SelectItem></SelectContent></Select></div>}
              <div className="space-y-1.5"><Label>Cover</Label><Select value={dmvicForm.coverCode} onValueChange={(v)=>setDmvicForm(x=>({...x,coverCode:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="100">Comprehensive</SelectItem><SelectItem value="200">Third Party</SelectItem><SelectItem value="300">Third Party, Theft & Fire</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={dmvicForm.phoneNumber} onChange={(e)=>setDmvicForm(x=>({...x,phoneNumber:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Email (optional)</Label><Input value={dmvicForm.email} onChange={(e)=>setDmvicForm(x=>({...x,email:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Insured KRA PIN</Label><Input value={dmvicForm.insuredPin} onChange={(e)=>setDmvicForm(x=>({...x,insuredPin:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Body type</Label><Input value={dmvicForm.bodyType} onChange={(e)=>setDmvicForm(x=>({...x,bodyType:e.target.value}))} /></div>
              {(dmvicForm.family==="A" || (dmvicForm.family==="D" && dmvicForm.certificateTypeCode!=="10")) && <div className="space-y-1.5"><Label>Licensed to carry</Label><Input type="number" min="1" value={dmvicForm.licensedToCarry} onChange={(e)=>setDmvicForm(x=>({...x,licensedToCarry:e.target.value}))} /></div>}
              {(dmvicForm.family==="B" || (dmvicForm.family==="D" && dmvicForm.certificateTypeCode==="10")) && <div className="space-y-1.5"><Label>Tonnage / carrying capacity</Label><Input type="number" min="1" value={dmvicForm.tonnage} onChange={(e)=>setDmvicForm(x=>({...x,tonnage:e.target.value}))} /></div>}
            </div>

            {latestCertificateOrder && <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="font-medium">{latestCertificateOrder.status==="issued" ? "Certificate issued" : latestCertificateOrder.status==="issuing" || latestCertificateOrder.status==="paid" ? "Issuing certificate" : latestCertificateOrder.status==="awaiting_payment" ? "Awaiting payment confirmation" : "Certificate preparation in progress"}</div>
              <div className="text-muted-foreground">
                {latestCertificateOrder.status==="issued"
                  ? `Certificate ${latestCertificateOrder.dmvic_certificate_number || p.certificate_no || ""} is ready.`
                  : latestCertificateOrder.status==="awaiting_payment"
                    ? `Amount due: KES ${Number(latestCertificateOrder.selling_price || 0).toLocaleString()}. Issuance starts automatically after the payment provider confirms payment.`
                    : "No manual provider action is required. This status updates automatically."}
              </div>
              {latestCertificateOrder.payment_reference && <div className="text-muted-foreground">Payment reference: {latestCertificateOrder.payment_reference}</div>}
            </div>}

            {dmvicResult && !dmvicResult.ok && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"><div className="font-medium">Certificate needs attention</div><div className="mt-1 text-muted-foreground">{dmvicResult.error || "Review the policy and vehicle details, then try again."}</div></div>}
            {dmvicOrder?.ok && !latestCertificateOrder && <div className="rounded-md border p-3 text-sm"><div className="font-medium">Ready for payment</div><div className="text-muted-foreground mt-1">Amount due: KES {Number(dmvicOrder.price).toLocaleString()}. The certificate will be issued automatically after payment is confirmed.</div></div>}

            <div className="flex flex-col sm:flex-row gap-2">
              {!latestCertificateOrder && <Button className="w-full sm:w-auto" disabled={dmvicBusy} onClick={async()=>{
                setDmvicBusy(true); setDmvicResult(null);
                try {
                  const status=await dmvicStatusFn();
                  if(!status.configured) throw new Error("Certificate service is not configured for this deployment.");
                  if(!p.insurer_id) throw new Error("Select an underwriter first.");
                  const memberCompanyId=Number((p.insurers as any)?.dmvic_member_company_id||0);
                  if(!memberCompanyId) throw new Error("This underwriter is not yet configured for certificate issuance.");
                  const year=Number(p.vehicles?.year || new Date().getFullYear());
                  const payload:any={certificateType:dmvicForm.family,memberCompanyId,coverCode:Number(dmvicForm.coverCode),policyholder:clientName||"",policyNumber:p.policy_no||"",commencementDate:p.start_date||"",expiryDate:p.end_date||"",registrationNumber:p.vehicles?.registration_no||undefined,chassisNumber:p.vehicles?.chassis_no||"",phoneNumber:dmvicForm.phoneNumber,bodyType:dmvicForm.bodyType,vehicleMake:p.vehicles?.make||undefined,vehicleModel:p.vehicles?.model||undefined,engineNumber:p.vehicles?.engine_no||undefined,email:dmvicForm.email,insuredPin:dmvicForm.insuredPin,yearOfRegistration:year,yearOfManufacture:p.vehicles?.year?Number(p.vehicles.year):undefined};
                  if(dmvicForm.family==="A"){payload.certificateTypeCode=Number(dmvicForm.certificateTypeCode);payload.licensedToCarry=Number(dmvicForm.licensedToCarry);}
                  if(dmvicForm.family==="B"){payload.vehicleType=Number(dmvicForm.vehicleType);payload.tonnageCarryingCapacity=Number(dmvicForm.tonnage);}
                  if(dmvicForm.family==="D"){payload.certificateTypeCode=Number(dmvicForm.certificateTypeCode);if(dmvicForm.certificateTypeCode==="10")payload.tonnage=Number(dmvicForm.tonnage);else payload.licensedToCarry=Number(dmvicForm.licensedToCarry);}
                  const sum=Number(p.sum_insured??p.vehicles?.estimated_value??0);if(sum)payload.sumInsured=sum;
                  const family=dmvicForm.family as "A"|"B"|"C"|"D";
                  const classification=family==="A"?Number(dmvicForm.certificateTypeCode):family==="B"?2:family==="C"?3:(dmvicForm.certificateTypeCode==="9"?9:4);
                  const r=await dmvicPrepareFn({data:{policyId:p.id,vehicleId:p.vehicle_id||null,insurerId:p.insurer_id,certificateType:family,classification,memberCompanyId,input:payload}});
                  setDmvicOrder(r);
                  if(!r.ok){setDmvicResult(r.validation || {ok:false,error:r.error});throw new Error(r.error||"Certificate could not be prepared.");}
                  toast.success("Certificate prepared. Awaiting payment confirmation.");
                  qc.invalidateQueries({queryKey:["dmvic-certificate-order",id]});
                } catch(e:any){toast.error(e?.message||"Could not prepare certificate");}
                finally{setDmvicBusy(false);}
              }}>{dmvicBusy ? "Preparing…" : "Prepare certificate"}</Button>}
              {latestCertificateOrder?.status==="awaiting_payment" && <Button className="w-full sm:w-auto" disabled>Awaiting payment confirmation</Button>}
              {(latestCertificateOrder?.status==="paid" || latestCertificateOrder?.status==="issuing") && <Button className="w-full sm:w-auto" disabled>Issuing certificate…</Button>}
              {latestCertificateOrder?.status==="issued" && <Button className="w-full sm:w-auto" disabled>Certificate issued</Button>}
            </div>
          </div>
          <DialogFooter className="sm:justify-end"><Button className="w-full sm:w-auto" variant="ghost" onClick={() => setDmvicOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={extOpen} onOpenChange={setExtOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add payment extension</DialogTitle>
            <DialogDescription>Record a balance the client will pay later. It shows on the dashboard until marked paid.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount (KES)</Label>
              <Input type="number" step="0.01" value={extForm.amount_due} onChange={(e) => setExtForm((f) => ({ ...f, amount_due: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={extForm.due_date} onChange={(e) => setExtForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea rows={3} value={extForm.reason} onChange={(e) => setExtForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. client to pay balance by end of month" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtOpen(false)}>Cancel</Button>
            <Button onClick={submitExtension} disabled={savingExt}>{savingExt ? "Saving…" : "Save extension"}</Button>
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}