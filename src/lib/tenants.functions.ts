import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyTenant = {
  id: string;
  name: string;
  slug: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_accent: string | null;
  tagline: string | null;
  status: string;
  plan: string;
  website?: string | null;
  mpesa_till?: string | null;
  mpesa_paybill?: string | null;
  paybill_account?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account_name?: string | null;
  bank_account_no?: string | null;
  stamp_url?: string | null;
  doc_footer_note?: string | null;
  signatory_name?: string | null;
  signatory_title?: string | null;
};

export const getMyTenant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ tenant: MyTenant | null; role: string | null; isSuperAdmin: boolean }> => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles ?? []).map((r: any) => r.role as string);
    const isSuperAdmin = roleList.includes("super_admin");

    const { data: member } = await supabase
      .from("tenant_members")
      .select("tenant_id, role, tenants(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .maybeSingle();

    if (!member) return { tenant: null, role: null, isSuperAdmin };
    return {
      tenant: (member as any).tenants,
      role: (member as any).role,
      isSuperAdmin,
    };
  });

const CreateTenantInput = z.object({
  name: z.string().min(2).max(120),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().max(30).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  tagline: z.string().max(160).optional().nullable(),
  brand_primary: z.string().max(20).optional().nullable(),
  brand_secondary: z.string().max(20).optional().nullable(),
  brand_accent: z.string().max(20).optional().nullable(),
  logo_url: z.string().max(600).optional().nullable(),
  insurer_ids: z.array(z.string().uuid()).default([]),
  branch_name: z.string().min(2).max(120),
  branch_address: z.string().max(300).optional().nullable(),
  branch_phone: z.string().max(30).optional().nullable(),
});

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => CreateTenantInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Guard: user must not already belong to a tenant
    const { data: existing } = await supabase
      .from("tenant_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) throw new Error("You already belong to an agency.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40)
      + "-" + Math.random().toString(36).slice(2, 6);

    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: data.name,
        slug,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
        address: data.address,
        city: data.city,
        country: data.country ?? "Kenya",
        tagline: data.tagline,
        brand_primary: data.brand_primary ?? "#dc2626",
        brand_secondary: data.brand_secondary ?? "#0f172a",
        brand_accent: data.brand_accent ?? "#f59e0b",
        logo_url: data.logo_url,
        onboarded_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (tErr || !tenant) throw new Error(tErr?.message ?? "Failed to create agency");

    // Member as admin
    await supabaseAdmin.from("tenant_members").insert({
      tenant_id: tenant.id, user_id: userId, role: "admin",
    });
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" as any }, { onConflict: "user_id,role" });

    // Update user's profile to this tenant
    await supabaseAdmin.from("profiles").update({ tenant_id: tenant.id }).eq("id", userId);

    // First branch (tenant_id auto-stamped by trigger, but we're using admin so set explicitly)
    await supabaseAdmin.from("branches").insert({
      tenant_id: tenant.id,
      name: data.branch_name,
      address: data.branch_address ?? null,
      phone: data.branch_phone ?? null,
      email: data.contact_email ?? null,
      is_active: true,
    } as any);

    // Insurer picks
    if (data.insurer_ids.length) {
      await supabaseAdmin.from("tenant_insurers").insert(
        data.insurer_ids.map((id) => ({ tenant_id: tenant.id, insurer_id: id, enabled: true })),
      );
    }

    return { tenant };
  });

const UpdateTenantInput = z.object({
  name: z.string().min(2).max(120).optional(),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().max(30).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  tagline: z.string().max(160).optional().nullable(),
  brand_primary: z.string().max(20).optional().nullable(),
  brand_secondary: z.string().max(20).optional().nullable(),
  brand_accent: z.string().max(20).optional().nullable(),
  logo_url: z.string().max(600).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  mpesa_till: z.string().max(30).optional().nullable(),
  mpesa_paybill: z.string().max(30).optional().nullable(),
  paybill_account: z.string().max(60).optional().nullable(),
  bank_name: z.string().max(120).optional().nullable(),
  bank_branch: z.string().max(120).optional().nullable(),
  bank_account_name: z.string().max(160).optional().nullable(),
  bank_account_no: z.string().max(60).optional().nullable(),
  doc_footer_note: z.string().max(400).optional().nullable(),
  signatory_name: z.string().max(120).optional().nullable(),
  signatory_title: z.string().max(120).optional().nullable(),
});

export const updateMyTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => UpdateTenantInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("tenant_members").select("tenant_id, role").eq("user_id", userId).maybeSingle();
    if (!member) throw new Error("No agency");
    if (!["admin", "manager"].includes((member as any).role)) throw new Error("Forbidden");
    const { error } = await supabase.from("tenants").update(data as any).eq("id", (member as any).tenant_id);
    if (error) throw error;
    return { ok: true };
  });

export const getMyTenantInsurers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: all } = await supabase.from("insurers").select("id, name, logo_url").order("name");
    const { data: linked } = await supabase.from("tenant_insurers").select("insurer_id, enabled");
    const enabledSet = new Set((linked ?? []).filter((r: any) => r.enabled).map((r: any) => r.insurer_id));
    return (all ?? []).map((i: any) => ({ ...i, enabled: enabledSet.has(i.id) }));
  });

export const setMyTenantInsurers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ insurer_ids: z.array(z.string().uuid()) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("tenant_members").select("tenant_id, role").eq("user_id", userId).maybeSingle();
    if (!member) throw new Error("No agency");
    if (!["admin", "manager"].includes((member as any).role)) throw new Error("Forbidden");
    const tid = (member as any).tenant_id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("tenant_insurers").delete().eq("tenant_id", tid);
    if (data.insurer_ids.length) {
      await supabaseAdmin.from("tenant_insurers").insert(
        data.insurer_ids.map((id) => ({ tenant_id: tid, insurer_id: id, enabled: true })),
      );
    }
    return { ok: true };
  });

// Upload logo: client uploads to storage, then calls this to persist URL (signed).
export const setTenantLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ storage_path: z.string().min(1) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("tenant_members").select("tenant_id, role").eq("user_id", userId).maybeSingle();
    if (!member) throw new Error("No agency");
    if (!["admin", "manager"].includes((member as any).role)) throw new Error("Forbidden");
    const tid = (member as any).tenant_id;
    if (!data.storage_path.startsWith(`${tid}/`)) throw new Error("Invalid upload path");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Sign for 10 years (max) so PDF/portal embedding works.
    const { data: signed } = await supabaseAdmin.storage
      .from("tenant-brand")
      .createSignedUrl(data.storage_path, 60 * 60 * 24 * 365 * 10);
    const url = signed?.signedUrl;
    if (!url) throw new Error("Failed to sign logo URL");
    const { error } = await supabaseAdmin.from("tenants").update({ logo_url: url }).eq("id", tid);
    if (error) throw error;
    return { url };
  });

// Upload company stamp: client uploads to storage, then calls this to persist a signed URL.
export const setTenantStamp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ storage_path: z.string().min(1) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("tenant_members").select("tenant_id, role").eq("user_id", userId).maybeSingle();
    if (!member) throw new Error("No agency");
    if (!["admin", "manager"].includes((member as any).role)) throw new Error("Forbidden");
    const tid = (member as any).tenant_id;
    if (!data.storage_path.startsWith(`${tid}/`)) throw new Error("Invalid upload path");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("tenant-brand")
      .createSignedUrl(data.storage_path, 60 * 60 * 24 * 365 * 10);
    const url = signed?.signedUrl;
    if (!url) throw new Error("Failed to sign stamp URL");
    const { error } = await supabaseAdmin.from("tenants").update({ stamp_url: url } as any).eq("id", tid);
    if (error) throw error;
    return { url };
  });

// Public: list insurers available to the current user's tenant
export const listMyInsurers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("tenant_insurers")
      .select("insurer_id, enabled, insurers(id, name, logo_url)")
      .eq("enabled", true);
    return (data ?? []).map((r: any) => r.insurers).filter(Boolean);
  });

export type MyBrand = {
  name: string;
  tagline: string | null;
  logo_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_accent: string | null;
};

export const getMyBrand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyBrand | null> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("tenant_members")
      .select("tenants(name, tagline, logo_url, brand_primary, brand_secondary, brand_accent)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .maybeSingle();
    const t: any = (data as any)?.tenants;
    if (!t) return null;
    return {
      name: t.name,
      tagline: t.tagline ?? null,
      logo_url: t.logo_url ?? null,
      brand_primary: t.brand_primary ?? null,
      brand_secondary: t.brand_secondary ?? null,
      brand_accent: t.brand_accent ?? null,
    };
  });