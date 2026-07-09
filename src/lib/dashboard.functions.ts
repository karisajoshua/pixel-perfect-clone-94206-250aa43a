import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardSummary = {
  totals: {
    clients: number;
    activePolicies: number;
    openClaims: number;
    dueRenewals: number;
    revenue: number;
    revenueThisMonth: number;
    activeCoverPremium: number;
    cancelledPolicies: number;
    cancelledThisMonth: number;
    outstandingExtensions: number;
    overdueExtensions: number;
  };
  byBranch: {
    branchId: string | null;
    branchName: string;
    revenue: number;
    share: number;
    policies: number;
    clients: number;
    activeCoverPremium: number;
  }[];
  recentCancellations: {
    id: string;
    policy_no: string;
    client_name: string;
    cancelled_at: string | null;
    cancellation_reason: string | null;
  }[];
  overdueExtensionsList: {
    id: string;
    policy_id: string;
    policy_no: string;
    client_name: string;
    amount_due: number;
    due_date: string;
  }[];
};

export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardSummary> => {
    const { supabase, userId } = context;
    const [{ data: rolesData }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("branch_id").eq("id", userId).maybeSingle(),
    ]);
    const roles = (rolesData ?? []).map((r: any) => r.role as string);
    const isAdmin = roles.includes("admin");
    const scopeBranchId: string | null = isAdmin ? null : (profile?.branch_id ?? null);
    const scope = <T extends { eq: (col: string, val: any) => T }>(q: T, col = "branch_id"): T =>
      scopeBranchId ? q.eq(col, scopeBranchId) : q;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const [policiesRes, claimsRes, renewalsRes, clientsRes, branchesRes, paymentsRes, extensionsRes] = await Promise.all([
      scope(supabase.from("policies").select("id, status, branch_id, premium_gross, start_date, cancelled_at")),
      scope(supabase.from("claims").select("id, status, branch_id")),
      scope(supabase.from("policies").select("id", { count: "exact", head: true }).gte("end_date", today).lte("end_date", in30).eq("status", "active")),
      scope(supabase.from("clients").select("id, branch_id")),
      scopeBranchId
        ? supabase.from("branches").select("id, name").eq("id", scopeBranchId)
        : supabase.from("branches").select("id, name"),
      supabase.from("payments").select("amount, paid_date, invoices!inner(branch_id)"),
      scope(supabase.from("policy_payment_extensions").select("id, policy_id, amount_due, due_date, status, branch_id").eq("status", "pending")),
    ]);

    const policies = (policiesRes.data ?? []) as any[];
    const claims = (claimsRes.data ?? []) as any[];
    const branches = (branchesRes.data ?? []) as any[];
    const clientsRows = (clientsRes.data ?? []) as any[];
    const paymentsRaw = (paymentsRes.data ?? []) as any[];
    const payments = scopeBranchId
      ? paymentsRaw.filter((p) => p.invoices?.branch_id === scopeBranchId)
      : paymentsRaw;

    const activePolicies = policies.filter((p) => p.status === "active");
    const cancelledPolicies = policies.filter((p) => p.status === "cancelled");
    const cancelledThisMonth = cancelledPolicies.filter((p) => p.cancelled_at && p.cancelled_at >= monthStart).length;
    const extensions = (extensionsRes.data ?? []) as any[];
    const outstandingExtensions = extensions.reduce((s, e) => s + Number(e.amount_due ?? 0), 0);
    const overdueExtensions = extensions.filter((e) => e.due_date < today).length;
    const activeCoverPremium = activePolicies.reduce((s, p) => s + Number(p.premium_gross ?? 0), 0);
    const revenue = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const revenueThisMonth = payments
      .filter((p) => p.paid_date && p.paid_date >= monthStart)
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);

    const revByBranch = new Map<string | null, number>();
    for (const p of payments) {
      const bid = p.invoices?.branch_id ?? null;
      revByBranch.set(bid, (revByBranch.get(bid) ?? 0) + Number(p.amount ?? 0));
    }
    const acpByBranch = new Map<string | null, number>();
    for (const p of activePolicies) {
      const bid = p.branch_id ?? null;
      acpByBranch.set(bid, (acpByBranch.get(bid) ?? 0) + Number(p.premium_gross ?? 0));
    }
    const polByBranch = new Map<string | null, number>();
    for (const p of policies) {
      polByBranch.set(p.branch_id ?? null, (polByBranch.get(p.branch_id ?? null) ?? 0) + 1);
    }
    const clientsByBranch = new Map<string | null, number>();
    for (const c of clientsRows) {
      clientsByBranch.set(c.branch_id ?? null, (clientsByBranch.get(c.branch_id ?? null) ?? 0) + 1);
    }

    const branchIds = new Set<string | null>([...revByBranch.keys(), ...acpByBranch.keys(), ...polByBranch.keys(), ...clientsByBranch.keys(), ...branches.map((b) => b.id)]);
    const byBranch = [...branchIds].map((id) => {
      const name = branches.find((b) => b.id === id)?.name ?? (id ? "Unknown branch" : "Unassigned");
      const r = revByBranch.get(id) ?? 0;
      return {
        branchId: id,
        branchName: name,
        revenue: r,
        share: revenue ? r / revenue : 0,
        policies: polByBranch.get(id) ?? 0,
        clients: clientsByBranch.get(id) ?? 0,
        activeCoverPremium: acpByBranch.get(id) ?? 0,
      };
    }).sort((a, b) => b.activeCoverPremium - a.activeCoverPremium);

    const { data: recentRaw } = await scope(
      supabase.from("policies")
        .select("id, policy_no, cancelled_at, cancellation_reason, clients(full_name, company_name, client_type)")
        .eq("status", "cancelled")
        .order("cancelled_at", { ascending: false })
        .limit(5)
    );
    const recentCancellations = ((recentRaw ?? []) as any[]).map((r) => ({
      id: r.id,
      policy_no: r.policy_no,
      client_name: r.clients?.client_type === "corporate" ? (r.clients?.company_name ?? r.clients?.full_name ?? "—") : (r.clients?.full_name ?? "—"),
      cancelled_at: r.cancelled_at,
      cancellation_reason: r.cancellation_reason,
    }));

    const overdueList = extensions.filter((e) => e.due_date < today)
      .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
      .slice(0, 5);
    let overdueExtensionsList: DashboardSummary["overdueExtensionsList"] = [];
    if (overdueList.length > 0) {
      const policyIds = [...new Set(overdueList.map((e) => e.policy_id))];
      const { data: polRows } = await supabase.from("policies")
        .select("id, policy_no, clients(full_name, company_name, client_type)")
        .in("id", policyIds);
      const polMap = new Map((polRows ?? []).map((p: any) => [p.id, p]));
      overdueExtensionsList = overdueList.map((e) => {
        const pol: any = polMap.get(e.policy_id);
        const cl = pol?.clients;
        const name = cl ? (cl.client_type === "corporate" ? (cl.company_name ?? cl.full_name ?? "—") : (cl.full_name ?? "—")) : "—";
        return {
          id: e.id,
          policy_id: e.policy_id,
          policy_no: pol?.policy_no ?? "—",
          client_name: name,
          amount_due: Number(e.amount_due ?? 0),
          due_date: e.due_date,
        };
      });
    }

    return {
      totals: {
        clients: clientsRows.length,
        activePolicies: activePolicies.length,
        openClaims: claims.filter((c) => !["paid", "closed", "rejected"].includes(c.status)).length,
        dueRenewals: renewalsRes.count ?? 0,
        revenue,
        revenueThisMonth,
        activeCoverPremium,
        cancelledPolicies: cancelledPolicies.length,
        cancelledThisMonth,
        outstandingExtensions,
        overdueExtensions,
      },
      byBranch,
      recentCancellations,
      overdueExtensionsList,
    };
  });