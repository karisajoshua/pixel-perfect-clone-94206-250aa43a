import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Forbidden: super admin only");
}

export type PlatformOverview = {
  totals: { agencies: number; clients: number; activePolicies: number; revenue: number; openClaims: number };
  agencies: {
    id: string; name: string; status: string; plan: string; onboarded_at: string | null;
    clients: number; activePolicies: number; revenue: number; openClaims: number;
  }[];
};

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformOverview> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: tenants }, { data: clients }, { data: policies }, { data: claims }, { data: payments }] = await Promise.all([
      supabaseAdmin.from("tenants").select("id, name, status, plan, onboarded_at").order("created_at"),
      supabaseAdmin.from("clients").select("id, tenant_id"),
      supabaseAdmin.from("policies").select("id, tenant_id, status"),
      supabaseAdmin.from("claims").select("id, tenant_id, status"),
      supabaseAdmin.from("payments").select("amount, invoices!inner(tenant_id)"),
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
      clients: clientsByT.get(t.id) ?? 0,
      activePolicies: activeByT.get(t.id) ?? 0,
      revenue: revByT.get(t.id) ?? 0,
      openClaims: openClaimsByT.get(t.id) ?? 0,
    }));

    return {
      totals: {
        agencies: tenants?.length ?? 0,
        clients: clients?.length ?? 0,
        activePolicies: agencies.reduce((s, a) => s + a.activePolicies, 0),
        revenue: agencies.reduce((s, a) => s + a.revenue, 0),
        openClaims: agencies.reduce((s, a) => s + a.openClaims, 0),
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
    const [{ data: tenant }, { data: members }, { data: branches }, { data: insurers }, { data: clients }, { data: policies }] = await Promise.all([
      supabaseAdmin.from("tenants").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", data.id),
      supabaseAdmin.from("branches").select("id, name, is_active").eq("tenant_id", data.id),
      supabaseAdmin.from("tenant_insurers").select("insurers(id, name)").eq("tenant_id", data.id).eq("enabled", true),
      supabaseAdmin.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", data.id),
      supabaseAdmin.from("policies").select("id, status").eq("tenant_id", data.id),
    ]);
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