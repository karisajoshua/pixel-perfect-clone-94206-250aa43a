import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, RefreshCw, Ban } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { productClassLabel } from "@/lib/product-classes";
import { PolicyFormDialog } from "@/components/policies/policy-form-dialog";
import { IpenPolicyLiveDrawer } from "@/components/ipen/policy-live-drawer";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { policyTermLabel } from "@/lib/utils";
import { policyBalance, balanceLabel, formatKES, isCoverActive } from "@/lib/policy-balance";
import { fetchChainInvoices, chainTotals } from "@/lib/policy-chain";
import { PaymentStatement } from "@/components/payments/payment-statement";

import {
  isInstallmentTerm, computeInstallmentSummary, buildNextCoverPayload,
  INSTALLMENT_PLAN_LABELS, type InstallmentPlan,
} from "@/lib/policy-installments";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Check as CheckIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { initiateMpesaExpress } from "@/lib/ipen/payments.functions";
import { getLifeBenefitsSchedule } from "@/lib/ipen/policies.functions";
import { Smartphone, Loader2 } from "lucide-react";

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
  const [extOpen, setExtOpen] = useState(false);
  const [extForm, setExtForm] = useState<{ amount_due: string; due_date: string; reason: string }>({ amount_due: "", due_date: "", reason: "" });
  const [savingExt, setSavingExt] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payPhone, setPayPhone] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [benefits, setBenefits] = useState<any>(null);
  const [benefitsBusy, setBenefitsBusy] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const stkFn = useServerFn(initiateMpesaExpress);
  const benefitsFn = useServerFn(getLifeBenefitsSchedule);

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

  const ipenProposalId = p.ipen_proposal_id ?? p.ipen_policy_id ?? null;
  const isLife = String(p.product_class ?? "").toLowerCase().includes("life");

  const openPay = () => {
    setPayPhone(p.clients?.phone ?? "");
    setPayAmount(String(p.premium_gross ?? ""));
    setPayOpen(true);
  };

  const submitPay = async () => {
    if (!ipenProposalId) return toast.error("This policy has no IPEN proposal id");
    if (!payPhone) return toast.error("Enter M-Pesa phone number");
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setPayBusy(true);
    try {
      await stkFn({ data: { proposalId: ipenProposalId, phoneNumber: payPhone, amount: amt } });
      toast.success("STK push sent — check the client's phone");
      setPayOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Payment failed");
    } finally { setPayBusy(false); }
  };

  const openBenefits = async () => {
    if (!ipenProposalId) return toast.error("This policy has no IPEN proposal id");
    setBenefitsOpen(true);
    setBenefitsBusy(true);
    try {
      const res = await benefitsFn({ data: { quoteId: ipenProposalId } });
      setBenefits(res);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load benefits schedule");
    } finally { setBenefitsBusy(false); }
  };

  return (
    <div className="p-8 space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/policies"><ArrowLeft className="h-4 w-4 mr-1" /> All policies</Link></Button>
      <PageHeader
        title={p.policy_no}
        subtitle={`${clientName} • ${productClassLabel(p.product_class, p.product_subclass, p.tonnage)} • ${p.cover_type}`}
        actions={
          <div className="flex gap-2">
            {isCoverActive(p) && (
              <Badge variant="outline" className="self-center border-green-300 text-green-800">Cover active</Badge>
            )}
            {p.ipen_policy_id && (
              <>
                <Badge variant="secondary" className="self-center">IPEN</Badge>
                <Button variant="outline" onClick={() => setIpenOpen(true)}>View live IPEN details</Button>
              </>
            )}
            {ipenProposalId && (
              <Button variant="outline" onClick={openPay}>
                <Smartphone className="h-4 w-4 mr-1" /> Process M-Pesa
              </Button>
            )}
            {ipenProposalId && isLife && (
              <Button variant="outline" onClick={openBenefits}>Benefits schedule</Button>
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
              <Item label="Status" value={p.status} />
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

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Process M-Pesa payment</DialogTitle>
            <DialogDescription>Sends an STK push to the client's phone via the IPEN gateway.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Phone number</Label>
              <Input value={payPhone} onChange={(e) => setPayPhone(e.target.value)} placeholder="2547XXXXXXXX" />
            </div>
            <div className="space-y-1.5"><Label>Amount (KES)</Label>
              <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={submitPay} disabled={payBusy}>
              {payBusy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Send STK push
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={benefitsOpen} onOpenChange={setBenefitsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Life benefits schedule</DialogTitle>
            <DialogDescription>Live from IPEN.</DialogDescription>
          </DialogHeader>
          {benefitsBusy ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <pre className="max-h-[420px] overflow-auto rounded border p-3 text-xs">
              {JSON.stringify(benefits ?? {}, null, 2)}
            </pre>
          )}
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