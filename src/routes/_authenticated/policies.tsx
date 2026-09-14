import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Plus, Search } from "lucide-react";
import { PolicyFormDialog } from "@/components/policies/policy-form-dialog";
import { policyTermLabel } from "@/lib/utils";
import { isInstallmentTerm } from "@/lib/policy-installments";
import { policyBalance, formatKES, isCoverActive } from "@/lib/policy-balance";

export const Route = createFileRoute("/_authenticated/policies")({ beforeLoad: requireRole(["admin", "manager", "agent"]), component: PoliciesLayout });

function PoliciesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/policies") return <Outlet />;
  return <PoliciesList />;
}

function PoliciesList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: policies, isLoading } = useQuery({
    queryKey: ["policies", search, status],
    queryFn: async () => {
      let q = supabase
        .from("policies")
        .select("id, policy_no, certificate_no, status, payment_status, start_date, end_date, premium_gross, policy_term, installment_plan, balance_due, client_id, product_class, risk_label, clients(full_name, company_name, client_type), insurers(name), vehicles(registration_no)")
        .order("end_date", { ascending: true })
        .limit(200);
      if (status === "rop") q = q.in("policy_term", ["rop", "six_months", "annual"]);
      else if (status === "tor") q = q.in("policy_term", ["tor"]);
      else if (status !== "all") q = q.eq("status", status);
      if (search) q = q.or(`policy_no.ilike.%${search}%,certificate_no.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Policies" subtitle="All issued and in-force policies."
        actions={<Button data-tour="policies-new" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New policy</Button>} />

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search policy number…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all", "active", "pending", "expired", "cancelled", "rop", "tor"].map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>{s === "rop" ? "ROP" : s === "tor" ? "1 mo TOR" : s}</Button>
          ))}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Policy #</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Insurer</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 font-medium">Premium</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && policies?.length === 0 && <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">No policies yet.</td></tr>}
              {policies?.map((p: any) => {
                const cl = p.clients;
                const name = cl ? (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) : "—";
                const bal = policyBalance(p);
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">
                      {p.policy_no}
                      {p.certificate_no && <div className="text-[11px] font-normal text-muted-foreground">Cert. {p.certificate_no}</div>}
                    </td>
                    <td className="px-4 py-3">{name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.vehicles?.registration_no ?? p.risk_label ?? "—"}</td>
                    <td className="px-4 py-3">{p.insurers?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{p.start_date} → <span className="font-medium">{p.end_date}</span></td>
                    <td className="px-4 py-3 text-xs">{policyTermLabel(p.policy_term)}</td>
                    <td className="px-4 py-3">
                      {p.premium_gross ? formatKES(Number(p.premium_gross)) : "—"}
                      {p.payment_status === "partial" && !bal.unknown && (
                        <div className="text-[11px] text-muted-foreground">Paid {formatKES(bal.paid)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 space-x-1">
                      <CoverBadge policy={p} />
                      <PayBadge status={p.payment_status} />
                      {p.payment_status !== "paid" && (bal.outstanding || bal.unknown) && (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          {bal.unknown ? "Balance not set" : `Bal. ${formatKES(bal.balance)}`}
                        </Badge>
                      )}
                      {isInstallmentTerm(p.policy_term) && p.payment_status !== "paid" && p.end_date <= new Date().toISOString().slice(0, 10) && (
                        <Badge variant="destructive">Installment due</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm"><Link to="/policies/$id" params={{ id: p.id }}>Open</Link></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <PolicyFormDialog open={open} onOpenChange={setOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["policies"] })} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-900 border-green-200",
    pending: "bg-yellow-100 text-yellow-900 border-yellow-200",
    expired: "bg-red-100 text-red-900 border-red-200",
    cancelled: "bg-gray-100 text-gray-700 border-gray-200",
    renewed: "bg-blue-100 text-blue-900 border-blue-200",
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${map[status] ?? ""}`}>{status}</span>;
}
function PayBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    unpaid: "bg-red-50 text-red-800 border-red-200",
    partial: "bg-amber-50 text-amber-800 border-amber-200",
    paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${map[status] ?? ""}`}>{status}</span>;
}