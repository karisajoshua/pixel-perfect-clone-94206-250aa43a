import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { Plus, Pencil, ArrowRight, Download, Check, X, Send, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { downloadQuotationPdf } from "@/lib/quotation-pdf";
import { useMyRoles } from "@/hooks/use-auth";
import { LifeQuoteWizard } from "@/components/ipen/life-quote-wizard";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quotations")({ beforeLoad: requireRole(["admin", "manager", "agent"]), component: QuotationsPage });

function QuotationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [lifeOpen, setLifeOpen] = useState(false);
  const { data: roles } = useMyRoles();
  const canApprove = (roles ?? []).some((r) => r === "admin" || r === "manager");

  const { data } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotations")
        .select("*, clients(full_name, company_name, client_type), insurers(name), vehicles(registration_no)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const convert = async (q: any) => {
    // eslint-disable-next-line no-alert
    if (!confirm(`Convert ${q.quote_no} to a policy?`)) return;
    const { data: u } = await supabase.auth.getUser();
    const today = new Date();
    const end = new Date(today);
    switch (q.policy_term) {
      case "tor":
      case "one_month_extendable": end.setDate(end.getDate() + 30); break;
      case "six_months": end.setDate(end.getDate() + 180); break;
      case "annual":
      default: end.setFullYear(end.getFullYear() + 1);
    }
    const { data, error } = await supabase.from("policies").insert({
      policy_no: `POL-${Date.now()}`,
      client_id: q.client_id, vehicle_id: q.vehicle_id, insurer_id: q.insurer_id, branch_id: q.branch_id,
      product_class: q.product_class, cover_type: q.cover_type, policy_term: q.policy_term ?? "annual",
      sum_insured: q.sum_insured, premium_gross: q.premium_gross, premium_net: q.premium_net,
      start_date: today.toISOString().slice(0,10), end_date: end.toISOString().slice(0,10),
      status: "pending", payment_status: "unpaid",
      created_by: u.user?.id,
    } as any).select("id").single();
    if (error) return toast.error(error.message);
    await supabase.from("quotations").update({ status: "converted", converted_policy_id: data!.id }).eq("id", q.id);
    qc.invalidateQueries({ queryKey: ["quotations"] });
    qc.invalidateQueries({ queryKey: ["policies"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Policy created from quote — update details", {
      action: { label: "Open policy", onClick: () => navigate({ to: "/policies/$id", params: { id: data!.id } }) },
    });
    navigate({ to: "/policies/$id", params: { id: data!.id } });
  };

  const submitForApproval = async (q: any) => {
    const { error } = await supabase.from("quotations").update({ status: "pending_approval", approval_required: true }).eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Submitted for approval");
    qc.invalidateQueries({ queryKey: ["quotations"] });
  };

  const approve = async (q: any) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("quotations").update({ status: "approved", approved_by: u.user?.id, approved_at: new Date().toISOString(), rejection_reason: null }).eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Approved");
    qc.invalidateQueries({ queryKey: ["quotations"] });
  };

  const reject = async (q: any) => {
    const reason = prompt("Reason for rejection?") ?? "";
    if (!reason) return;
    const { error } = await supabase.from("quotations").update({ status: "rejected", rejection_reason: reason }).eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    qc.invalidateQueries({ queryKey: ["quotations"] });
  };

  const revise = async (q: any) => {
    if (!confirm(`Create a new revision of ${q.quote_no}?`)) return;
    const { data: u } = await supabase.auth.getUser();
    const { id, created_at, updated_at, clients, insurers, vehicles, approved_by, approved_at, ...base } = q as any;
    const newQuote = {
      ...base,
      quote_no: `${q.quote_no}-R${(q.revision ?? 1) + 1}`,
      status: "draft",
      revision: (q.revision ?? 1) + 1,
      parent_quote_id: q.id,
      approval_required: false,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      converted_policy_id: null,
      created_by: u.user?.id,
    };
    const { error } = await supabase.from("quotations").insert(newQuote);
    if (error) return toast.error(error.message);
    toast.success("Revision created");
    qc.invalidateQueries({ queryKey: ["quotations"] });
  };

  const handleDownload = async (quoteId: string) => {
    const t = toast.loading("Preparing PDF…");
    try {
      const { data, error } = await supabase.from("quotations")
        .select("*, clients(id, full_name, company_name, client_type, email, phone), insurers(name), vehicles(registration_no, make, model, year), branches(name, address, phone, email)")
        .eq("id", quoteId).single();
      if (error || !data) throw new Error(error?.message ?? "Failed to load quotation");
      const q: any = data;
      await downloadQuotationPdf({ quotation: q, client: q.clients, branch: q.branches, insurer: q.insurers, vehicle: q.vehicles });
      toast.success("Quotation downloaded", { id: t });
    } catch (e: any) {
      console.error("Quotation download failed", e);
      toast.error(e?.message ?? "Download failed", { id: t });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Quotations" subtitle="Quote drafts that can be converted into policies."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLifeOpen(true)}>
              <Heart className="h-4 w-4 mr-1" /> IPEN life quote
            </Button>
            <Button onClick={() => { setEdit(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New quote
            </Button>
          </div>
        } />
      <LifeQuoteWizard open={lifeOpen} onOpenChange={setLifeOpen} />
      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by quote #, client, insurer, vehicle…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Quote #</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Insurer</th>
                <th className="px-4 py-3 font-medium">Premium</th>
                <th className="px-4 py-3 font-medium">Valid until</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const term = search.trim().toLowerCase();
                const filtered = (data ?? []).filter((q: any) => {
                  if (!term) return true;
                  const cl = q.clients;
                  const name = cl ? (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) : "";
                  return [q.quote_no, name, q.insurers?.name, q.vehicles?.registration_no]
                    .filter(Boolean).some((v: string) => v.toLowerCase().includes(term));
                });
                if (filtered.length === 0) return <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">{term ? "No matches." : "No quotes yet."}</td></tr>;
                return filtered.map((q: any) => {
                const cl = q.clients; const name = cl ? (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) : "—";
                return (
                  <tr key={q.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">{q.quote_no}</td>
                    <td className="px-4 py-3">{name}</td>
                    <td className="px-4 py-3">{q.insurers?.name ?? "—"}</td>
                    <td className="px-4 py-3">{q.premium_gross ? `KES ${Number(q.premium_gross).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">{q.valid_until ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant={q.status === "converted" ? "default" : "secondary"}>{q.status}</Badge></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(q.id)}><Download className="h-4 w-4 mr-1" /> PDF</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEdit(q); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      {q.status === "draft" && (
                        <Button size="sm" variant="ghost" onClick={() => submitForApproval(q)}><Send className="h-3 w-3 mr-1" /> Submit</Button>
                      )}
                      {q.status === "pending_approval" && canApprove && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => approve(q)}><Check className="h-3 w-3 mr-1" /> Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => reject(q)}><X className="h-3 w-3 mr-1" /> Reject</Button>
                        </>
                      )}
                      {(q.status === "rejected" || q.status === "expired") && (
                        <Button size="sm" variant="ghost" onClick={() => revise(q)}>Revise</Button>
                      )}
                      {q.status !== "converted" && (
                        <Button size="sm" variant="outline" onClick={() => convert(q)}>Convert <ArrowRight className="h-3 w-3 ml-1" /></Button>
                      )}
                    </td>
                  </tr>
                );
                });
              })()}
            </tbody>
          </table>
        </div>
      </Card>
      <QuoteDialog open={open} onOpenChange={setOpen} initial={edit} onSaved={() => qc.invalidateQueries({ queryKey: ["quotations"] })} />
    </div>
  );
}

function QuoteDialog({ open, onOpenChange, initial, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  const [clients, setClients] = useState<any[]>([]);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [clientText, setClientText] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const BENEFIT_OPTIONS = [
    "Excess Protector Own Damage",
    "Excess Protector Theft",
    "Political Violence and Terrorism",
    "Loss of Use",
  ];

  useEffect(() => {
    if (!open) return;
    const v = new Date(); v.setDate(v.getDate() + 14);
    const init = initial ?? { quote_no: `Q-${Date.now()}`, status: "draft", product_class: "motor_private", cover_type: "comprehensive", policy_term: "annual", valid_until: v.toISOString().slice(0,10), line_items: { rate_pct: 0, levies: 0, benefits: [] } };
    if (!init.line_items) init.line_items = { rate_pct: 0, levies: 0, benefits: [] };
    setForm(init);
    setClientText("");
    supabase.from("clients").select("id, full_name, company_name, client_type").order("full_name").then(({ data }) => setClients(data ?? []));
    supabase.from("tenant_insurers").select("insurers(id, name, active)").eq("enabled", true).then(({ data }) => {
      const rows = (data ?? []).map((r: any) => r.insurers).filter((i: any) => i && i.active).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setInsurers(rows);
    });
    supabase.from("vehicles").select("id, registration_no, client_id").then(({ data }) => setVehicles(data ?? []));
  }, [open, initial]);

  // When editing, hydrate clientText from selected client
  useEffect(() => {
    if (!form.client_id || clientText) return;
    const c = clients.find((c) => c.id === form.client_id);
    if (c) setClientText(c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name);
  }, [clients, form.client_id]);

  const li = form.line_items ?? {};
  const ratePct = Number(li.rate_pct ?? 0);
  const benefits: string[] = Array.isArray(li.benefits) ? li.benefits : [];
  const sumInsured = Number(form.sum_insured ?? 0);
  const isThirdParty = form.cover_type === "third_party" || form.cover_type === "third_party_fire_theft";
  const flatPremium = Number(li.flat_premium ?? 0);
  const benefitRatePct = li.benefit_rate_pct === undefined || li.benefit_rate_pct === null || li.benefit_rate_pct === ""
    ? 0.25
    : Number(li.benefit_rate_pct);
  const basePremium = isThirdParty
    ? flatPremium
    : +(sumInsured * (ratePct / 100)).toFixed(2);
  const benefitPremium = isThirdParty
    ? 0
    : +(sumInsured * (benefitRatePct / 100) * benefits.length).toFixed(2);
  const pllEnabled = !!li.pll_enabled;
  const paEnabled = !!li.pa_enabled;
  const pllAmount = isThirdParty || !pllEnabled ? 0 : Number(li.pll_amount ?? 0);
  const paAmount = isThirdParty || !paEnabled ? 0 : Number(li.pa_amount ?? 0);
  const premiumGross = +(basePremium + benefitPremium + pllAmount + paAmount).toFixed(2);
  const levies = +(premiumGross * 0.0045 + 40).toFixed(2);
  const total = +(premiumGross + levies).toFixed(2);

  const setLi = (k: string, v: any) => set("line_items", { ...li, [k]: v });
  const toggleBenefit = (name: string) => {
    const next = benefits.includes(name) ? benefits.filter((b) => b !== name) : [...benefits, name];
    setLi("benefits", next);
  };

  const filteredClients = (() => {
    const t = clientText.trim().toLowerCase();
    if (!t) return clients.slice(0, 8);
    return clients.filter((c) => {
      const name = c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name;
      return name?.toLowerCase().includes(t);
    }).slice(0, 8);
  })();

  const matchedClient = clients.find((c) => {
    const name = c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name;
    return name?.toLowerCase() === clientText.trim().toLowerCase();
  });

  const submit = async () => {
    const typed = clientText.trim();
    if (!typed) return toast.error("Client name is required");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();

    // Resolve or create client
    let clientId = matchedClient?.id ?? form.client_id ?? null;
    if (!matchedClient) {
      const { data: newClient, error: cErr } = await supabase.from("clients")
        .insert({ full_name: typed, client_type: "individual", created_by: u.user?.id } as any)
        .select("id").single();
      if (cErr) { setSaving(false); return toast.error(cErr.message); }
      clientId = newClient!.id;
    }

    const payload = {
      ...form,
      client_id: clientId,
      premium_gross: premiumGross,
      premium_net: basePremium,
      sum_insured: isThirdParty ? null : form.sum_insured ?? null,
      line_items: isThirdParty
        ? { flat_premium: flatPremium, levies }
        : {
            rate_pct: ratePct,
            benefit_rate_pct: benefitRatePct,
            levies,
            benefits,
            pll_enabled: pllEnabled,
            pll_amount: pllAmount,
            pa_enabled: paEnabled,
            pa_amount: paAmount,
          },
      created_by: u.user?.id,
    };
    const op = initial?.id
      ? supabase.from("quotations").update(payload).eq("id", initial.id).select("id").single()
      : supabase.from("quotations").insert(payload).select("id").single();
    const { data: saved, error } = await op as any;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    if (saved?.id && clientId) {
      const { sendTransactionalEmail, clientDisplayName, formatKES } = await import("@/lib/email/send");
      const { data: c } = await supabase.from("clients").select("email, full_name, company_name, client_type").eq("id", clientId).maybeSingle();
      if (c?.email) {
        const insurer = insurers.find((i: any) => i.id === form.insurer_id);
        sendTransactionalEmail({
          templateName: "quotation-sent",
          recipientEmail: c.email,
          idempotencyKey: `quotation-sent-${saved.id}`,
          templateData: {
            clientName: clientDisplayName(c),
            quoteNo: form.quote_no,
            insurerName: insurer?.name ?? '',
            premium: premiumGross ? formatKES(premiumGross) : '',
            sumInsured: sumInsured ? formatKES(sumInsured) : '',
            validUntil: form.valid_until ?? '',
            productClass: form.product_class ?? '',
            coverType: form.cover_type ?? '',
          },
        });
      }
    }
    onSaved?.(); onOpenChange(false);
  };

  const vForClient = matchedClient ? vehicles.filter((v) => v.client_id === matchedClient.id) : vehicles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit quote" : "New quote"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Quote #</Label><Input value={form.quote_no ?? ""} onChange={(e) => set("quote_no", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Valid until</Label><Input type="date" value={form.valid_until ?? ""} onChange={(e) => set("valid_until", e.target.value)} /></div>
          <div className="sm:col-span-2 space-y-1.5 relative">
            <Label>Client *</Label>
            <Input
              placeholder="Type client name (creates a new client if it doesn't exist)"
              value={clientText}
              onChange={(e) => { setClientText(e.target.value); setShowClientList(true); set("client_id", null); }}
              onFocus={() => setShowClientList(true)}
              onBlur={() => setTimeout(() => setShowClientList(false), 150)}
            />
            {showClientList && filteredClients.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-56 overflow-auto">
                {filteredClients.map((c) => {
                  const name = c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name;
                  return (
                    <button key={c.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setClientText(name ?? ""); set("client_id", c.id); setShowClientList(false); }}
                    >{name}</button>
                  );
                })}
              </div>
            )}
            {clientText.trim() && !matchedClient && (
              <p className="text-xs text-muted-foreground">New client "{clientText.trim()}" will be created on save.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            <Select value={form.vehicle_id ?? ""} onValueChange={(v) => set("vehicle_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{vForClient.map((v) => <SelectItem key={v.id} value={v.id}>{v.registration_no}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Insurer</Label>
            <Select value={form.insurer_id ?? ""} onValueChange={(v) => set("insurer_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Insurer" /></SelectTrigger>
              <SelectContent>{insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cover type</Label>
            <Select value={form.cover_type} onValueChange={(v) => set("cover_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comprehensive">Comprehensive</SelectItem>
                <SelectItem value="third_party">Third party</SelectItem>
                <SelectItem value="third_party_fire_theft">TPFT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Policy term</Label>
            <Select value={form.policy_term ?? "annual"} onValueChange={(v) => set("policy_term", v)}>
              <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tor">One month (TOR)</SelectItem>
                <SelectItem value="one_month_extendable">One month extendable</SelectItem>
                <SelectItem value="six_months">6 months</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isThirdParty ? (
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Premium (KES)</Label>
              <Input type="number" step="0.01" value={li.flat_premium ?? ""} onChange={(e) => setLi("flat_premium", e.target.value ? Number(e.target.value) : 0)} />
              <p className="text-xs text-muted-foreground">Flat premium for third-party cover.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5"><Label>Sum insured</Label><Input type="number" value={form.sum_insured ?? ""} onChange={(e) => set("sum_insured", e.target.value ? Number(e.target.value) : null)} /></div>
              <div className="space-y-1.5"><Label>Rate %</Label><Input type="number" step="0.01" value={li.rate_pct ?? ""} onChange={(e) => setLi("rate_pct", e.target.value ? Number(e.target.value) : 0)} /></div>
            </>
          )}
          {!isThirdParty && (
          <div className="sm:col-span-2 space-y-2">
            <Label>Additional Benefits</Label>
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 w-40">
                <Label className="text-xs">Benefit rate %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={li.benefit_rate_pct ?? 0.25}
                  onChange={(e) => setLi("benefit_rate_pct", e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <p className="text-xs text-muted-foreground pb-2">
                Each selected benefit is priced at {benefitRatePct}% of the sum insured. Editable for commercial risks.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BENEFIT_OPTIONS.map((b) => {
                const checked = benefits.includes(b);
                return (
                  <label key={b} className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleBenefit(b)} />
                    <span className="text-sm">{b}</span>
                  </label>
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className={`flex items-center gap-3 rounded-md border px-3 py-2 ${pllEnabled ? "border-primary bg-primary/5" : ""}`}>
                <Checkbox checked={pllEnabled} onCheckedChange={(v) => setLi("pll_enabled", !!v)} />
                <span className="text-sm flex-1">Passenger Legal Liability (PLL)</span>
                <Input
                  className="w-32"
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  disabled={!pllEnabled}
                  value={li.pll_amount ?? ""}
                  onChange={(e) => setLi("pll_amount", e.target.value ? Number(e.target.value) : 0)}
                />
              </div>
              <div className={`flex items-center gap-3 rounded-md border px-3 py-2 ${paEnabled ? "border-primary bg-primary/5" : ""}`}>
                <Checkbox checked={paEnabled} onCheckedChange={(v) => setLi("pa_enabled", !!v)} />
                <span className="text-sm flex-1">Personal Accident (PA)</span>
                <Input
                  className="w-32"
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  disabled={!paEnabled}
                  value={li.pa_amount ?? ""}
                  onChange={(e) => setLi("pa_amount", e.target.value ? Number(e.target.value) : 0)}
                />
              </div>
            </div>
          </div>
          )}
          <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Base premium</span><span>KES {basePremium.toLocaleString()}</span></div>
            {!isThirdParty && (
              <div className="flex justify-between"><span className="text-muted-foreground">Additional benefits ({benefits.length})</span><span>KES {benefitPremium.toLocaleString()}</span></div>
            )}
            {!isThirdParty && pllEnabled && (
              <div className="flex justify-between"><span className="text-muted-foreground">Passenger Legal Liability (PLL)</span><span>KES {pllAmount.toLocaleString()}</span></div>
            )}
            {!isThirdParty && paEnabled && (
              <div className="flex justify-between"><span className="text-muted-foreground">Personal Accident (PA)</span><span>KES {paAmount.toLocaleString()}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Levies (0.45% + KES 40)</span><span>KES {levies.toLocaleString()}</span></div>
            <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total premium payable</span><span>KES {total.toLocaleString()}</span></div>
          </div>
          <div className="sm:col-span-2 space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.quote_no || !clientText.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}