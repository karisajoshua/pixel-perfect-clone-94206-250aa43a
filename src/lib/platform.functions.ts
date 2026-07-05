import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Forbidden: super admin only");
}

export type PlatformOverview = {
  totals: {
    agencies: number; clients: number; activePolicies: number; revenue: number; openClaims: number;
    noticesLast30: number; newAgenciesLast30: number;
  };
  agencies: {
    id: string; name: string; status: string; plan: string; onboarded_at: string | null;
    contact_email: string | null;
    clients: number; activePolicies: number; revenue: number; openClaims: number;
  }[];
};

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformOverview> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: tenants }, { data: clients }, { data: policies }, { data: claims }, { data: payments }, noticesRes] = await Promise.all([
      supabaseAdmin.from("tenants").select("id, name, status, plan, onboarded_at, contact_email, created_at").order("created_at"),
      supabaseAdmin.from("clients").select("id, tenant_id"),
      supabaseAdmin.from("policies").select("id, tenant_id, status"),
      supabaseAdmin.from("claims").select("id, tenant_id, status"),
      supabaseAdmin.from("payments").select("amount, invoices!inner(tenant_id)"),
      supabaseAdmin.from("platform_notices").select("id", { count: "exact", head: true }).gte("created_at", since30),
    ]);

    const clientsByT = new Map<string, number>();
    (clients ?? []).forEach((c: any) => clientsByT.set(c.tenant_id, (clientsByT.get(c.tenant_id) ?? 0) + 1));
    const activeByT = new Map<string, number>();
    (policies ?? []).forEach((p: any) => { if (p.status === "active") activeByT.set(p.tenant_id, (activeByT.get(p.tenant_id) ?? 0) + 1); });
    const openClaimsByT = new Map<string, number>();
    (claims ?? []).forEach((c: any) => { if (!["paid","closed","rejected"].includes(c.status)) openClaimsByT.set(c.tenant_id, (openClaimsByT.get(c.tenant_id) ?? 0) + 1); });
    const revByT = new Map<string, number>();
    (payments ?? []).forEach((p: any) => {
      const tid = p.invoices?.tenant_id;
      if (!tid) return;
      revByT.set(tid, (revByT.get(tid) ?? 0) + Number(p.amount ?? 0));
    });

    const agencies = (tenants ?? []).map((t: any) => ({
      id: t.id, name: t.name, status: t.status, plan: t.plan, onboarded_at: t.onboarded_at,
      contact_email: t.contact_email ?? null,
      clients: clientsByT.get(t.id) ?? 0,
      activePolicies: activeByT.get(t.id) ?? 0,
      revenue: revByT.get(t.id) ?? 0,
      openClaims: openClaimsByT.get(t.id) ?? 0,
    }));

    const newAgenciesLast30 = (tenants ?? []).filter((t: any) => t.created_at && t.created_at >= since30).length;

    return {
      totals: {
        agencies: tenants?.length ?? 0,
        clients: clients?.length ?? 0,
        activePolicies: agencies.reduce((s, a) => s + a.activePolicies, 0),
        revenue: agencies.reduce((s, a) => s + a.revenue, 0),
        openClaims: agencies.reduce((s, a) => s + a.openClaims, 0),
        noticesLast30: (noticesRes as any)?.count ?? 0,
        newAgenciesLast30,
      },
      agencies,
    };
  });

export const getAgencyDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: tenant }, { data: members }, { data: branches }, { data: insurers }, { data: clients }, { data: policies }, { data: recentClaims }, { data: recentInvoices }, { data: paymentsAll }, { data: auditRows }] = await Promise.all([
      supabaseAdmin.from("tenants").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", data.id),
      supabaseAdmin.from("branches").select("id, name, is_active").eq("tenant_id", data.id),
      supabaseAdmin.from("tenant_insurers").select("insurers(id, name)").eq("tenant_id", data.id).eq("enabled", true),
      supabaseAdmin.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", data.id),
      supabaseAdmin.from("policies").select("id, status").eq("tenant_id", data.id),
      supabaseAdmin.from("claims").select("id, claim_no, status, claim_amount, created_at").eq("tenant_id", data.id).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("invoices").select("id, invoice_no, total, amount_paid, status, issue_date").eq("tenant_id", data.id).order("issue_date", { ascending: false }).limit(10),
      supabaseAdmin.from("payments").select("amount, paid_date").eq("tenant_id", data.id).gte("paid_date", new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString().slice(0,10)),
      supabaseAdmin.from("audit_log").select("id, action, entity_type, entity_id, created_at, user_id").eq("tenant_id", data.id).order("created_at", { ascending: false }).limit(20),
    ]);

    // Monthly revenue last 6 months
    const now = new Date();
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleString(undefined, { month: "short" }), total: 0 });
    }
    (paymentsAll ?? []).forEach((p: any) => {
      if (!p.paid_date) return;
      const key = String(p.paid_date).slice(0, 7);
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.total += Number(p.amount ?? 0);
    });

    return {
      tenant,
      members: (members ?? []).map((m: any) => ({
        user_id: m.user_id, role: m.role,
        full_name: m.profiles?.full_name ?? "—", email: m.profiles?.email ?? "—",
      })),
      branches: branches ?? [],
      insurers: (insurers ?? []).map((r: any) => r.insurers).filter(Boolean),
      clientCount: clients?.length ?? 0,
      policyCount: (policies ?? []).length,
      activePolicyCount: (policies ?? []).filter((p: any) => p.status === "active").length,
      recentClaims: recentClaims ?? [],
      recentInvoices: recentInvoices ?? [],
      monthlyRevenue: months,
      auditLog: auditRows ?? [],
    };
  });

export const setAgencyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tenants").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setAgencyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), plan: z.enum(["starter", "pro", "enterprise"]) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tenants").update({ plan: data.plan }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ================== Platform Notices ==================

export type PlatformNotice = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  audience: "all" | "tenant";
  tenant_id: string | null;
  tenant_name?: string | null;
  created_at: string;
};

export const listPlatformNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformNotice[]> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_notices")
      .select("id, title, body, severity, audience, tenant_id, created_at, tenants(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((n: any) => ({
      id: n.id, title: n.title, body: n.body, severity: n.severity,
      audience: n.audience, tenant_id: n.tenant_id,
      tenant_name: n.tenants?.name ?? null,
      created_at: n.created_at,
    }));
  });

export const sendPlatformNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    title: z.string().min(2).max(160),
    body: z.string().min(2).max(4000),
    severity: z.enum(["info", "warning", "critical"]).default("info"),
    audience: z.enum(["all", "tenant"]),
    tenant_id: z.string().uuid().nullable().optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.audience === "tenant" && !data.tenant_id) throw new Error("tenant_id required for tenant audience");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("platform_notices")
      .insert({
        title: data.title,
        body: data.body,
        severity: data.severity,
        audience: data.audience,
        tenant_id: data.audience === "tenant" ? data.tenant_id : null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, id: row.id };
  });

export const deletePlatformNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_notices").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ================== Cross-tenant audit log ==================

export const getPlatformAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    tenant_id: z.string().uuid().nullable().optional(),
    action: z.string().max(80).nullable().optional(),
    limit: z.number().min(1).max(500).default(200),
  }).parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("audit_log")
      .select("id, action, entity_type, entity_id, created_at, user_id, tenant_id, metadata, tenants(name), profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.tenant_id) q = q.eq("tenant_id", data.tenant_id);
    if (data.action) q = q.eq("action", data.action);
    const { data: rows } = await q;
    return (rows ?? []).map((r: any) => ({
      id: r.id, action: r.action, entity_type: r.entity_type, entity_id: r.entity_id,
      created_at: r.created_at, tenant_id: r.tenant_id,
      tenant_name: r.tenants?.name ?? null,
      user_name: r.profiles?.full_name ?? r.profiles?.email ?? null,
    }));
  });