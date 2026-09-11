/**
 * WhatsApp admin server functions (client-callable RPC).
 * All privileged provider work happens server-side; credentials never leave the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhone } from "@/lib/phone";
import { extractVariables, unsupportedVariables } from "./template-library";

// ---------- helpers ----------

async function assertManager(supabase: any, userId: string) {
  for (const r of ["admin", "manager", "super_admin"] as const) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) return;
  }
  throw new Error("Forbidden: admin or manager role required");
}

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Forbidden: platform owner only");
}

async function currentTenant(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("current_tenant_id");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You are not a member of any agency");
  return data as string;
}

/** Strips anything sensitive before a channel row reaches the browser. */
function safeChannel(row: any) {
  if (!row) return null;
  const { credentials_ref, ...rest } = row;
  return { ...rest, credentials_configured: !!credentials_ref, credentials_ref: credentials_ref ?? null };
}

// ---------- overview ----------

export const getWhatsAppOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const tenantId = await currentTenant(supabase);

    // Keep the shared library in step with the shipped definitions.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncPlatformTemplates, templateUsage } = await import("./library.server");
    try {
      await syncPlatformTemplates(supabaseAdmin);
    } catch (e) {
      console.warn("[whatsapp] template library sync failed", e);
    }
    const templateUsageMap = await templateUsage(supabaseAdmin, tenantId);

    const [{ data: channel }, { data: templates }, { data: messages }, { data: conversations }] = await Promise.all([
      supabase.from("messaging_channels").select("*").eq("tenant_id", tenantId).eq("channel", "whatsapp").maybeSingle(),
      supabase.from("whatsapp_templates").select("*").order("owner_scope").order("name"),
      supabase.from("conversation_messages").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(25),
      supabase.from("conversations").select("*").eq("tenant_id", tenantId).order("last_message_at", { ascending: false, nullsFirst: false }).limit(15),
    ]);

    const { data: consents } = await supabase.from("contact_consents").select("status").eq("tenant_id", tenantId);
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await supabase
      .from("messaging_usage").select("*").eq("tenant_id", tenantId).eq("channel", "whatsapp").eq("usage_date", today).maybeSingle();

    const counts = (messages ?? []).reduce((acc: Record<string, number>, m: any) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      channel: safeChannel(channel),
      templates: (templates ?? []).map((t: any) => ({
        ...t,
        usage: templateUsageMap[t.name] ?? { total: 0, active: 0, names: [] },
      })),
      messages: messages ?? [],
      conversations: conversations ?? [],
      consent: {
        opted_in: (consents ?? []).filter((c: any) => c.status === "opted_in").length,
        opted_out: (consents ?? []).filter((c: any) => c.status === "opted_out").length,
      },
      usage: { date: today, sent: usage?.sent_count ?? 0, limit: channel?.daily_message_limit ?? null },
      recent_status_counts: counts,
      webhook_url: "/api/public/whatsapp/webhook",
    };
  });

// ---------- channel configuration ----------

const channelSchema = z.object({
  waba_id: z.string().trim().max(120).nullable().optional(),
  phone_number_id: z.string().trim().max(120).nullable().optional(),
  display_phone_number: z.string().trim().max(40).nullable().optional(),
  display_name: z.string().trim().max(120).nullable().optional(),
  credentials_ref: z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(120).nullable().optional(),
  mode: z.enum(["test", "production"]).optional(),
  test_recipients: z.array(z.string().trim()).max(20).optional(),
  daily_message_limit: z.number().int().min(1).max(100000).optional(),
  per_minute_limit: z.number().int().min(1).max(1000).optional(),
  is_active: z.boolean().optional(),
});

export const saveWhatsAppChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => channelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const tenantId = await currentTenant(supabase);

    const patch: Record<string, unknown> = { ...data };
    if (data.test_recipients) {
      patch.test_recipients = data.test_recipients.map((p) => normalizePhone(p)).filter(Boolean);
    }

    const { data: existing } = await supabase
      .from("messaging_channels").select("id").eq("tenant_id", tenantId).eq("channel", "whatsapp").maybeSingle();

    let row: any;
    if (existing) {
      const { data: updated, error } = await supabase
        .from("messaging_channels").update(patch).eq("id", existing.id).select("*").single();
      if (error) throw new Error(error.message);
      row = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from("messaging_channels")
        .insert({ tenant_id: tenantId, channel: "whatsapp", provider: "meta_cloud", created_by: userId, ...patch })
        .select("*").single();
      if (error) throw new Error(error.message);
      row = inserted;
    }

    await supabase.from("audit_log").insert({
      tenant_id: tenantId, user_id: userId,
      action: existing ? "whatsapp.channel_changed" : "whatsapp.channel_connected",
      entity_type: "whatsapp", entity_id: row.id,
      metadata: { mode: row.mode, phone_number_id: row.phone_number_id, has_credentials_ref: !!row.credentials_ref },
    });
    return safeChannel(row);
  });

/** Calls the provider to confirm the credentials work, then records the status. */
export const testWhatsAppConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const tenantId = await currentTenant(supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTenantChannel } = await import("./gateway.server");
    const { getProvider } = await import("./provider.server");

    const channel = await getTenantChannel(supabaseAdmin, tenantId);
    if (!channel) throw new Error("Configure the WhatsApp sender first");
    const health = await getProvider(channel.provider).health(channel);

    await supabaseAdmin.from("messaging_channels").update({
      status: health.ok ? "connected" : "error",
      last_error: health.ok ? null : health.detail ?? "Connection failed",
      last_verified_at: new Date().toISOString(),
      ...(health.display_name ? { display_name: health.display_name } : {}),
    }).eq("id", channel.id);

    await supabase.from("audit_log").insert({
      tenant_id: tenantId, user_id: userId, action: "whatsapp.channel_changed",
      entity_type: "whatsapp", entity_id: channel.id, metadata: { health_ok: health.ok, detail: health.detail ?? null },
    });
    return { ok: health.ok, detail: health.detail ?? null, display_name: health.display_name ?? null };
  });

// ---------- templates ----------

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores").max(80),
  display_name: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(400).nullable().optional(),
  library_group: z.string().trim().max(40).nullable().optional(),
  language: z.string().trim().min(2).max(10).default("en"),
  category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]).default("UTILITY"),
  header: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(1).max(2000),
  footer: z.string().trim().max(200).nullable().optional(),
  variables: z.array(z.string().trim().min(1)).max(20).default([]),
  provider_template_name: z.string().trim().max(120).nullable().optional(),
  provider_template_id: z.string().trim().max(120).nullable().optional(),
  status: z.enum(["draft", "pending", "approved", "rejected", "disabled"]).optional(),
  meta_status: z.enum(["not_submitted", "pending", "approved", "rejected", "disabled"]).optional(),
  is_active: z.boolean().optional(),
});

/** Blocks unsupported placeholders and empty bodies before anything is stored. */
function validateTemplateBody(body: string, declared: string[]) {
  const unsupported = unsupportedVariables(body);
  if (unsupported.length) {
    throw new Error(`Unsupported placeholder${unsupported.length > 1 ? "s" : ""}: ${unsupported.map((v) => `{{${v}}}`).join(", ")}`);
  }
  const used = extractVariables(body);
  const orphan = declared.filter((d) => !used.includes(d) && !/^\d+$/.test(d));
  if (orphan.length) {
    throw new Error(`These placeholders are listed but not used in the message: ${orphan.join(", ")}`);
  }
  return used;
}

export const saveWhatsAppTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const tenantId = await currentTenant(supabase);

    const used = validateTemplateBody(data.body, data.variables ?? []);
    if (!data.variables?.length) data.variables = used;

    if (data.id) {
      const { data: existing, error: exErr } = await supabase
        .from("whatsapp_templates").select("*").eq("id", data.id).maybeSingle();
      if (exErr) throw new Error(exErr.message);
      if (!existing) throw new Error("Template not found");
      if (existing.owner_scope === "platform") {
        throw new Error("Ready-made templates cannot be edited — copy it to your agency first");
      }
      const { id, ...patch } = data;
      const { data: row, error } = await supabase.from("whatsapp_templates").update(patch).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      await supabase.from("audit_log").insert({
        tenant_id: tenantId, user_id: userId, action: "whatsapp.template_updated",
        entity_type: "whatsapp_template", entity_id: row.id, metadata: { name: row.name, status: row.status },
      });
      return row;
    }

    const { data: row, error } = await supabase
      .from("whatsapp_templates")
      .insert({ ...data, tenant_id: tenantId, owner_scope: "agency", created_by: userId })
      .select("*").single();
    if (error) {
      if ((error as any).code === "23505") throw new Error("Your agency already has a template with this name and language");
      throw new Error(error.message);
    }
    await supabase.from("audit_log").insert({
      tenant_id: tenantId, user_id: userId, action: "whatsapp.template_created",
      entity_type: "whatsapp_template", entity_id: row.id, metadata: { name: row.name },
    });
    return row;
  });

export const cloneWhatsAppTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const tenantId = await currentTenant(supabase);
    const { data: src, error } = await supabase.from("whatsapp_templates").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!src) throw new Error("Template not found");

    const { data: row, error: insErr } = await supabase.from("whatsapp_templates").insert({
      tenant_id: tenantId, owner_scope: "agency", name: src.name, language: src.language, category: src.category,
      header: src.header, body: src.body, footer: src.footer, variables: src.variables,
      display_name: src.display_name, description: src.description, library_group: src.library_group,
      provider_template_name: src.provider_template_name, status: "draft", meta_status: "not_submitted",
      cloned_from: src.id, created_by: userId,
    }).select("*").single();
    if (insErr) {
      if (insErr.code === "23505") throw new Error("Your agency already has a template with this name and language");
      throw new Error(insErr.message);
    }
    await supabase.from("audit_log").insert({
      tenant_id: tenantId, user_id: userId, action: "whatsapp.template_created",
      entity_type: "whatsapp_template", entity_id: row.id, metadata: { name: row.name, cloned_from: src.id },
    });
    return row;
  });

export const setWhatsAppTemplateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "pending", "approved", "rejected", "disabled"]).optional(),
      meta_status: z.enum(["not_submitted", "pending", "approved", "rejected", "disabled"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const tenantId = await currentTenant(supabase);
    const patch: Record<string, string> = {};
    if (data.status) patch.status = data.status;
    if (data.meta_status) patch.meta_status = data.meta_status;
    if (!Object.keys(patch).length) throw new Error("Nothing to update");
    const { data: row, error } = await supabase
      .from("whatsapp_templates").update(patch).eq("id", data.id).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Template not found or not editable");
    await supabase.from("audit_log").insert({
      tenant_id: tenantId, user_id: userId, action: "whatsapp.template_activated",
      entity_type: "whatsapp_template", entity_id: row.id, metadata: { status: data.status },
    });
    return row;
  });

export const deleteWhatsAppTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const { error } = await supabase.from("whatsapp_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- controlled test send ----------

export const sendWhatsAppTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      to: z.string().trim().min(6),
      mode: z.enum(["dry_run", "live_test"]),
      template: z.string().trim().optional(),
      language: z.string().trim().default("en"),
      variables: z.record(z.string(), z.string()).default({}),
      message: z.string().trim().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const tenantId = await currentTenant(supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWhatsAppTemplate, sendWhatsAppText } = await import("./gateway.server");

    const common = {
      tenantId,
      to: data.to,
      dryRun: data.mode === "dry_run",
      test: true,
      idempotencyKey: `manual-test:${tenantId}:${crypto.randomUUID()}`,
      label: "admin-test",
      actorId: userId,
    };
    const res = data.template
      ? await sendWhatsAppTemplate(supabaseAdmin, { ...common, template: data.template, language: data.language, variables: data.variables })
      : await sendWhatsAppText(supabaseAdmin, { ...common, body: data.message ?? "" });
    // Explicit, plainly-serializable shape for the RPC boundary.
    return {
      ok: res.ok,
      status: res.status,
      dry_run: res.dry_run ?? false,
      test: res.test ?? false,
      message_id: res.message_id ?? null,
      provider_message_id: res.provider_message_id ?? null,
      skipped_reason: res.skipped_reason ?? null,
      error: res.error ?? null,
      retryable: res.retryable ?? false,
      preview: res.preview ? JSON.stringify(res.preview) : null,
    };
  });

// ---------- consent ----------

export const setWhatsAppConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      phone: z.string().trim().min(6),
      status: z.enum(["opted_in", "opted_out"]),
      client_id: z.string().uuid().nullable().optional(),
      source: z.string().trim().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const tenantId = await currentTenant(supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setConsent } = await import("./gateway.server");
    return setConsent(supabaseAdmin, {
      tenantId, phone: data.phone, status: data.status,
      source: data.source ?? "admin", clientId: data.client_id ?? null,
    });
  });

export const listWhatsAppConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("contact_consents").select("*").order("changed_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- platform view ----------

export const getWhatsAppPlatformHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [{ data: channels }, { data: recent }, { data: failures }, { data: hooks }] = await Promise.all([
      supabaseAdmin.from("messaging_channels").select("*, tenants(name)").eq("channel", "whatsapp"),
      supabaseAdmin.from("conversation_messages").select("tenant_id, status, created_at").gte("created_at", since).limit(5000),
      supabaseAdmin.from("conversation_messages").select("id, tenant_id, error, error_code, created_at")
        .eq("status", "failed").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("whatsapp_webhook_events").select("id, kind, received_at, processed_at, error")
        .order("received_at", { ascending: false }).limit(20),
    ]);

    const volume = (recent ?? []).reduce((acc: Record<string, number>, m: any) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      channels: (channels ?? []).map((c: any) => ({
        ...safeChannel(c), tenant_name: c.tenants?.name ?? null, tenants: undefined,
      })),
      connected: (channels ?? []).filter((c: any) => c.status === "connected").length,
      volume_7d: volume,
      recent_failures: failures ?? [],
      webhook_events: hooks ?? [],
      webhook_unprocessed: (hooks ?? []).filter((h: any) => !h.processed_at).length,
    };
  });
