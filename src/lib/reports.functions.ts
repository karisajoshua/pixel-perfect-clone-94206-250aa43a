import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  from: z.string(), // ISO date
  to: z.string(),
  branchId: z.string().uuid().nullable().optional(),
});

export type ReportsSummary = {
  range: { from: string; to: string };
  kpis: {
    revenue: number;
    activePolicies: number;
    newClients: number;
    openClaims: number;
    renewalHitRate: number; // 0..1
  };
  revenueOverTime: { month: string; revenue: number }[];
  policiesByStatus: { status: string; count: number }[];
  insurerShare: { insurer: string; premium: number }[];
  claimsFunnel: { stage: string; count: number }[];
  branchPerformance: { branch: string; policies: number; premium: number; claims: number }[];
  topAgents: { agent: string; policies: number; premium: number }[];
};

export const getReportsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => Input.parse(v))
  .handler(async ({ data, context }): Promise<ReportsSummary> => {
    const { supabase, userId } = context;
    const { from, to } = data;

    // Enforce branch scope for non-admins: ignore client-supplied branchId
    const [{ data: rolesData }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("branch_id").eq("id", userId).maybeSingle(),
    ]);
    const roles = (rolesData ?? []).map((r: any) => r.role as string);
    const isAdmin = roles.includes("admin");
    const branchId: string | null = isAdmin ? (data.branchId ?? null) : (profile?.branch_id ?? null);

    const branchFilter = (q: any) => (branchId ? q.eq("branch_id", branchId) : q);

    const [paymentsRes, policiesRes, clientsRes, claimsRes, branchesRes, profilesRes, insurersRes] = await Promise.all([
      branchFilter(supabase.from("payments").select("amount, paid_at, invoice_id, invoices!inner(branch_id)").gte("paid_at", from).lte("paid_at", to)),
      branchFilter(supabase.from("policies").select("id, status, premium_gross, insurer_id, branch_id, created_by, start_date, end_date, insurers(name)")),
      branchFilter(supabase.from("clients").select("id, created_at, branch_id").gte("created_at", from).lte("created_at", to)),
      branchFilter(supabase.from("claims").select("id, status, branch_id")),
      supabase.from("branches").select("id, name"),
      supabase.from("profiles").select("id, full_name, branch_id"),
      supabase.from("insurers").select("id, name"),
    ]);

    const payments = paymentsRes.data ?? [];
    const policies = policiesRes.data ?? [];
    const clients = clientsRes.data ?? [];
    const claims = claimsRes.data ?? [];
    const branches = branchesRes.data ?? [];
    const profiles = profilesRes.data ?? [];

    const revenue = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const activePolicies = policies.filter((p: any) => p.status === "active").length;
    const newClients = clients.length;
    const openClaims = claims.filter((c: any) => !["paid", "closed", "rejected"].includes(c.status)).length;

    // Renewal hit rate: policies that ended within [from,to] and were renewed (status active|renewed) vs total ended.
    const endedInRange = policies.filter((p: any) => p.end_date >= from && p.end_date <= to);
    const renewed = endedInRange.filter((p: any) => p.status === "active" || p.status === "renewed").length;
    const renewalHitRate = endedInRange.length ? renewed / endedInRange.length : 0;

    // Revenue over time — monthly buckets
    const monthly = new Map<string, number>();
    for (const p of payments) {
      if (!p.paid_at) continue;
      const m = String(p.paid_at).slice(0, 7);
      monthly.set(m, (monthly.get(m) ?? 0) + Number(p.amount ?? 0));
    }
    const revenueOverTime = [...monthly.entries()].sort().map(([month, revenue]) => ({ month, revenue }));

    // Policies by status
    const statusMap = new Map<string, number>();
    for (const p of policies) statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1);
    const policiesByStatus = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

    // Insurer share — premium written
    const insurerMap = new Map<string, number>();
    for (const p of policies) {
      const name = (p as any).insurers?.name ?? "—";
      insurerMap.set(name, (insurerMap.get(name) ?? 0) + Number(p.premium_gross ?? 0));
    }
    const insurerShare = [...insurerMap.entries()]
      .map(([insurer, premium]) => ({ insurer, premium }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 10);

    // Claims funnel
    const stages = ["reported", "assessed", "approved", "paid"] as const;
    const claimsFunnel = stages.map((stage) => ({
      stage,
      count: claims.filter((c: any) => c.status === stage).length,
    }));

    // Branch perf
    const branchPerformance = branches.map((b: any) => {
      const bPolicies = policies.filter((p: any) => p.branch_id === b.id);
      const bClaims = claims.filter((c: any) => c.branch_id === b.id);
      return {
        branch: b.name,
        policies: bPolicies.length,
        premium: bPolicies.reduce((s: number, p: any) => s + Number(p.premium_gross ?? 0), 0),
        claims: bClaims.length,
      };
    });

    // Top agents
    const agentMap = new Map<string, { policies: number; premium: number }>();
    for (const p of policies) {
      const key = p.created_by ?? "unknown";
      const cur = agentMap.get(key) ?? { policies: 0, premium: 0 };
      cur.policies += 1;
      cur.premium += Number(p.premium_gross ?? 0);
      agentMap.set(key, cur);
    }
    const topAgents = [...agentMap.entries()]
      .map(([id, v]) => ({
        agent: profiles.find((pr: any) => pr.id === id)?.full_name ?? "Unknown",
        ...v,
      }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 8);

    return {
      range: { from, to },
      kpis: { revenue, activePolicies, newClients, openClaims, renewalHitRate },
      revenueOverTime,
      policiesByStatus,
      insurerShare,
      claimsFunnel,
      branchPerformance,
      topAgents,
    };
  });