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
  };
  byBranch: {
    branchId: string | null;
    branchName: string;
    revenue: number;
    share: number;
    policies: number;
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
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const [paymentsRes, policiesRes, claimsRes, renewalsRes, clientsRes, branchesRes] = await Promise.all([
      scopeBranchId
        ? supabase.from("payments").select("amount, paid_at, invoices!inner(branch_id)").eq("invoices.branch_id", scopeBranchId)
        : supabase.from("payments").select("amount, paid_at, invoices!inner(branch_id)"),
      scope(supabase.from("policies").select("id, status, branch_id")),
      scope(supabase.from("claims").select("id, status, branch_id")),
      scope(supabase.from("policies").select("id", { count: "exact", head: true }).gte("end_date", today).lte("end_date", in30).eq("status", "active")),
      scope(supabase.from("clients").select("id", { count: "exact", head: true })),
      scopeBranchId
        ? supabase.from("branches").select("id, name").eq("id", scopeBranchId)
        : supabase.from("branches").select("id, name"),
    ]);

    const payments = (paymentsRes.data ?? []) as any[];
    const policies = (policiesRes.data ?? []) as any[];
    const claims = (claimsRes.data ?? []) as any[];
    const branches = (branchesRes.data ?? []) as any[];

    const revenue = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const revenueThisMonth = payments
      .filter((p) => p.paid_at && p.paid_at >= monthStart)
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);

    const revByBranch = new Map<string | null, number>();
    for (const p of payments) {
      const bid = p.invoices?.branch_id ?? null;
      revByBranch.set(bid, (revByBranch.get(bid) ?? 0) + Number(p.amount ?? 0));
    }
    const polByBranch = new Map<string | null, number>();
    for (const p of policies) {
      polByBranch.set(p.branch_id ?? null, (polByBranch.get(p.branch_id ?? null) ?? 0) + 1);
    }

    const branchIds = new Set<string | null>([...revByBranch.keys(), ...polByBranch.keys(), ...branches.map((b) => b.id)]);
    const byBranch = [...branchIds].map((id) => {
      const name = branches.find((b) => b.id === id)?.name ?? (id ? "Unknown branch" : "Unassigned");
      const r = revByBranch.get(id) ?? 0;
      return {
        branchId: id,
        branchName: name,
        revenue: r,
        share: revenue ? r / revenue : 0,
        policies: polByBranch.get(id) ?? 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return {
      totals: {
        clients: clientsRes.count ?? 0,
        activePolicies: policies.filter((p) => p.status === "active").length,
        openClaims: claims.filter((c) => !["paid", "closed", "rejected"].includes(c.status)).length,
        dueRenewals: renewalsRes.count ?? 0,
        revenue,
        revenueThisMonth,
      },
      byBranch,
    };
  });