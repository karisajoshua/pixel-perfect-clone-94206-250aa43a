/**
 * ZIAM WhatsApp Gateway (server-only).
 *
 * Single entry point for every outbound WhatsApp message. The Automation
 * Engine, admin tools and future inbox all call these functions — never Meta
 * directly. Responsibilities:
 *   channel resolution → phone normalisation → consent → test/production guard
 *   → quota → idempotency → conversation + message log → provider → audit.
 */
import { normalizePhone } from "@/lib/phone";
import { getProvider, type ProviderChannel } from "./provider.server";
import { isWhatsAppSessionOpen } from "./session";
import type {
  MessageStatus,
  SendMediaArgs,
  SendResult,
  SendTemplateArgs,
  SendTextArgs,
} from "./types";

type Admin = any;

const CHANNEL = "whatsapp";

function now(): string {
  return new Date().toISOString();
}

function fail(error: string, retryable: boolean, extra: Partial<SendResult> = {}): SendResult {
  return { ok: false, message_id: null, provider_message_id: null, status: "failed", timestamp: now(), error, retryable, ...extra };
}

function skipped(reason: string, extra: Partial<SendResult> = {}): SendResult {
  return { ok: true, message_id: null, provider_message_id: null, status: "skipped", timestamp: now(), skipped_reason: reason, ...extra };
}

export async function auditWhatsApp(
  admin: Admin,
  tenantId: string | null,
  action: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
  userId: string | null = null,
) {
  if (!tenantId) return;
  try {
    await admin.from("audit_log").insert({
      tenant_id: tenantId,
      user_id: userId,
      action,
      entity_type: "whatsapp",
      entity_id: entityId,
      metadata,
    });
  } catch (e) {
    console.warn("[whatsapp] audit insert failed", e);
  }
}

// ---------- channel ----------

export async function getTenantChannel(admin: Admin, tenantId: string) {
  const { data, error } = await admin
    .from("messaging_channels")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("channel", CHANNEL)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function findChannelByPhoneNumberId(admin: Admin, phoneNumberId: string) {
  const { data, error } = await admin
    .from("messaging_channels")
    .select("*")
    .eq("phone_number_id", phoneNumberId)
    .eq("channel", CHANNEL)
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

// ---------- consent ----------

export async function getConsent(admin: Admin, tenantId: string, phone: string) {
  const { data } = await admin
    .from("contact_consents")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("channel", CHANNEL)
    .eq("phone", phone)
    .maybeSingle();
  return data ?? null;
}

export async function setConsent(
  admin: Admin,
  args: { tenantId: string; phone: string; status: "opted_in" | "opted_out"; source?: string; clientId?: string | null },
) {
  const phone = normalizePhone(args.phone);
  if (!phone) throw new Error("A valid phone number is required");
  const { error } = await admin.from("contact_consents").upsert(
    {
      tenant_id: args.tenantId,
      client_id: args.clientId ?? null,
      channel: CHANNEL,
      phone,
      status: args.status,
      source: args.source ?? "manual",
      changed_at: now(),
    },
    { onConflict: "tenant_id,channel,phone" },
  );
  if (error) throw new Error(error.message);
  await auditWhatsApp(admin, args.tenantId, "whatsapp.consent_changed", null, { phone, status: args.status, source: args.source ?? "manual" });
  return { phone, status: args.status };
}

// ---------- conversation ----------

export async function ensureConversation(
  admin: Admin,
  args: { tenantId: string; phone: string; channelId?: string | null; clientId?: string | null; contactName?: string | null },
) {
  const { data: existing } = await admin
    .from("conversations")
    .select("*")
    .eq("tenant_id", args.tenantId)
    .eq("channel", CHANNEL)
    .eq("external_contact", args.phone)
    .maybeSingle();
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (args.clientId && !existing.client_id) {
      patch.client_id = args.clientId;
      patch.identification = "identified";
    }
    if (args.channelId && !existing.channel_id) patch.channel_id = args.channelId;
    if (args.contactName && !existing.contact_name) patch.contact_name = args.contactName;
    if (Object.keys(patch).length) {
      const { data } = await admin.from("conversations").update(patch).eq("id", existing.id).select("*").maybeSingle();
      return data ?? existing;
    }
    return existing;
  }
  const { data, error } = await admin
    .from("conversations")
    .insert({
      tenant_id: args.tenantId,
      client_id: args.clientId ?? null,
      channel: CHANNEL,
      channel_id: args.channelId ?? null,
      external_contact: args.phone,
      contact_name: args.contactName ?? null,
      identification: args.clientId ? "identified" : "unidentified",
      status: "open",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await admin
        .from("conversations").select("*")
        .eq("tenant_id", args.tenantId).eq("channel", CHANNEL).eq("external_contact", args.phone).maybeSingle();
      if (raced) return raced;
    }
    throw new Error(error.message);
  }
  return data;
}

/** Tenant-scoped customer lookup by normalised phone. Never searches globally. */
export async function identifyClient(
  admin: Admin,
  tenantId: string,
  phone: string,
): Promise<{ client_id: string | null; identification: "identified" | "unidentified" | "ambiguous"; name?: string | null }> {
  const local = phone.startsWith("+254") ? "0" + phone.slice(4) : null;
  const candidates = [phone, local].filter(Boolean) as string[];
  const orFilter = candidates.flatMap((p) => [`phone.eq.${p}`, `alt_phone.eq.${p}`]).join(",");
  const { data, error } = await admin
    .from("clients")
    .select("id, full_name, company_name, client_type")
    .eq("tenant_id", tenantId)
    .or(orFilter)
    .limit(5);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 1) {
    const c = rows[0];
    return { client_id: c.id, identification: "identified", name: c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name };
  }
  if (rows.length > 1) return { client_id: null, identification: "ambiguous" };
  return { client_id: null, identification: "unidentified" };
}

// ---------- templates ----------

export async function resolveTemplate(admin: Admin, tenantId: string, name: string, language = "en") {
  const { data, error } = await admin
    .from("whatsapp_templates")
    .select("*")
    .eq("name", name)
    .eq("language", language)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  // Agency copy wins over the platform template.
  return rows.find((t: any) => t.tenant_id === tenantId) ?? rows.find((t: any) => t.tenant_id === null) ?? null;
}

/** Orders variables to the template's declared list and renders a preview body. */
export function buildTemplateValues(template: any, variables: Record<string, unknown> | unknown[] | undefined) {
  const declared: string[] = Array.isArray(template?.variables) ? template.variables.map(String) : [];
  let values: string[];
  if (Array.isArray(variables)) {
    values = variables.map((v) => (v == null ? "" : String(v)));
  } else {
    const obj = (variables ?? {}) as Record<string, unknown>;
    values = declared.map((k) => (obj[k] == null ? "" : String(obj[k])));
  }
  const missing = declared.filter((k, i) => !values[i]);
  let preview = String(template?.body ?? "");
  values.forEach((v, i) => {
    preview = preview.split(`{{${i + 1}}}`).join(v);
  });
  return { declared, values, missing, preview };
}

// ---------- core send ----------

interface CorePayload {
  kind: "text" | "template" | "media";
  message_type: "text" | "template" | "image" | "document" | "audio" | "video";
  body?: string;
  template?: { id: string | null; name: string; language: string; components?: unknown[]; values: string[] };
  media?: { type: "image" | "document" | "audio" | "video"; link: string; caption?: string; filename?: string };
}

async function coreSend(
  admin: Admin,
  args: SendTextArgs | SendTemplateArgs | SendMediaArgs,
  build: (channel: any, conversationOpen: boolean) => Promise<CorePayload | SendResult>,
): Promise<SendResult> {
  const tenantId = args.tenantId;

  // 1. Recipient
  const to = normalizePhone(args.to);
  if (!to) return fail("Recipient phone number is missing or invalid", false);

  // 2. Channel
  let channel: any;
  try {
    channel = await getTenantChannel(admin, tenantId);
  } catch (e: any) {
    return fail(e?.message ?? "Channel lookup failed", true);
  }
  if (!channel) return fail("WhatsApp is not configured for this agency", false);
  if (!channel.is_active || channel.status === "disabled") return fail("The agency WhatsApp channel is disabled", false);
  if (channel.status !== "connected" && !args.dryRun) return fail("The agency WhatsApp channel is not connected", false);

  // 3. Test / production guard — never silently message a production customer.
  const allowedTest: string[] = (channel.test_recipients ?? []).map((p: string) => normalizePhone(p)).filter(Boolean);
  const isTestRecipient = allowedTest.includes(to);
  const isTest = args.test === true || channel.mode === "test";
  if (!args.dryRun && channel.mode === "test" && !isTestRecipient) {
    return skipped("test_mode_recipient_not_allowlisted", {
      preview: { to, mode: channel.mode, allowed: allowedTest.length },
    });
  }
  if (!args.dryRun && args.test === true && !isTestRecipient) {
    return skipped("test_send_recipient_not_allowlisted", { preview: { to } });
  }

  // 4. Consent (proactive messages only)
  const consent = await getConsent(admin, tenantId, to);
  if (consent?.status === "opted_out" && !args.session) {
    return skipped("opted_out", { preview: { to } });
  }

  // 5. Conversation + session window
  const conversation = await ensureConversation(admin, {
    tenantId,
    phone: to,
    channelId: channel.id,
    clientId: args.clientId ?? null,
  });
  const sessionOpen = isWhatsAppSessionOpen(conversation);

  // 6. Build the payload (template validation lives here)
  const built = await build(channel, sessionOpen);
  if ("ok" in built) return built as SendResult;
  const payload = built as CorePayload;

  // 7. Idempotency — a retry never produces a second WhatsApp message.
  const idem = args.idempotencyKey ?? null;
  if (idem) {
    const { data: prior } = await admin
      .from("conversation_messages").select("*").eq("idempotency_key", idem).maybeSingle();
    if (prior) {
      return {
        ok: prior.status !== "failed",
        message_id: prior.id,
        provider_message_id: prior.provider_message_id,
        status: prior.status as MessageStatus,
        timestamp: prior.created_at,
        dry_run: prior.dry_run,
        test: prior.is_test,
        skipped_reason: prior.status === "skipped" ? "duplicate" : undefined,
        error: prior.error ?? undefined,
      };
    }
  }

  const baseRow = {
    tenant_id: tenantId,
    conversation_id: conversation.id,
    client_id: args.clientId ?? conversation.client_id ?? null,
    channel: CHANNEL,
    direction: "outbound",
    message_type: payload.message_type,
    template_id: payload.template?.id ?? null,
    template_name: payload.template?.name ?? null,
    language: payload.template?.language ?? null,
    body: payload.body ?? null,
    variables: payload.template ? { values: payload.template.values } : {},
    media: payload.media ?? null,
    provider: channel.provider,
    recipient: to,
    sender: channel.display_phone_number ?? null,
    workflow_run_id: args.workflowRunId ?? null,
    workflow_step_id: args.workflowStepId ?? null,
    idempotency_key: idem,
    is_test: isTest,
    payload: { label: args.label ?? null, session_open: sessionOpen },
  };

  // 8. Dry run — validated, logged, nothing sent.
  if (args.dryRun) {
    const { data: row } = await admin
      .from("conversation_messages")
      .insert({ ...baseRow, status: "skipped", dry_run: true, error: null, payload: { ...baseRow.payload, dry_run: true, reason: "DRY RUN — NOT SENT" } })
      .select("id, created_at").maybeSingle();
    return {
      ok: true,
      message_id: row?.id ?? null,
      provider_message_id: null,
      status: "skipped",
      timestamp: row?.created_at ?? now(),
      dry_run: true,
      test: isTest,
      skipped_reason: "dry_run",
      preview: {
        note: "DRY RUN — NOT SENT",
        to,
        type: payload.message_type,
        template: payload.template?.name ?? null,
        language: payload.template?.language ?? null,
        variables: payload.template?.values ?? null,
        body: payload.body ?? null,
      },
    };
  }

  // 9. Quota
  const { data: allowed, error: quotaErr } = await admin.rpc("messaging_consume_quota", {
    p_tenant: tenantId,
    p_channel: CHANNEL,
    p_limit: channel.daily_message_limit ?? 1000,
  });
  if (quotaErr) return fail(`Quota check failed: ${quotaErr.message}`, true);
  if (allowed === false) {
    await auditWhatsApp(admin, tenantId, "whatsapp.quota_exceeded", channel.id, { limit: channel.daily_message_limit });
    return fail("Daily WhatsApp message quota reached for this agency", true);
  }

  // 10. Log queued, then send
  const { data: row, error: rowErr } = await admin
    .from("conversation_messages").insert({ ...baseRow, status: "queued" }).select("id, created_at").single();
  if (rowErr) {
    if (rowErr.code === "23505" && idem) {
      const { data: prior } = await admin.from("conversation_messages").select("*").eq("idempotency_key", idem).maybeSingle();
      if (prior) {
        return {
          ok: prior.status !== "failed", message_id: prior.id, provider_message_id: prior.provider_message_id,
          status: prior.status as MessageStatus, timestamp: prior.created_at, skipped_reason: "duplicate",
        };
      }
    }
    return fail(rowErr.message, true);
  }

  const provider = getProvider(channel.provider);
  const providerChannel: ProviderChannel = {
    id: channel.id, tenant_id: channel.tenant_id, provider: channel.provider,
    waba_id: channel.waba_id, phone_number_id: channel.phone_number_id,
    display_phone_number: channel.display_phone_number, credentials_ref: channel.credentials_ref,
  };
  const res = await provider.send(providerChannel, {
    to,
    kind: payload.kind,
    body: payload.body,
    template: payload.template
      ? { name: payload.template.name, language: payload.template.language, components: payload.template.components }
      : undefined,
    media: payload.media,
  });

  if (!res.ok) {
    await admin.from("conversation_messages")
      .update({ status: "failed", error: res.error ?? "Send failed", error_code: res.error_code ?? null, failed_at: now() })
      .eq("id", row.id);
    await auditWhatsApp(admin, tenantId, "whatsapp.message_failed", row.id, {
      to, template: payload.template?.name ?? null, error: res.error, code: res.error_code,
    });
    return fail(res.error ?? "Send failed", res.retryable !== false, { message_id: row.id });
  }

  const sentAt = now();
  await admin.from("conversation_messages")
    .update({ status: "sent", provider_message_id: res.provider_message_id ?? null, sent_at: sentAt })
    .eq("id", row.id);
  await admin.from("conversations")
    .update({ last_outbound_at: sentAt, last_message_at: sentAt }).eq("id", conversation.id);
  if (baseRow.client_id) {
    await admin.from("client_communications").insert({
      tenant_id: tenantId,
      client_id: baseRow.client_id,
      channel: "whatsapp",
      direction: "outbound",
      subject: payload.template?.name ?? "WhatsApp message",
      body: payload.body ?? payload.template?.name ?? null,
    }).then(() => undefined, () => undefined);
  }
  await auditWhatsApp(admin, tenantId, "whatsapp.message_sent", row.id, {
    to, type: payload.message_type, template: payload.template?.name ?? null,
    provider_message_id: res.provider_message_id ?? null, test: isTest,
  });

  return {
    ok: true, message_id: row.id, provider_message_id: res.provider_message_id ?? null,
    status: "sent", timestamp: sentAt, test: isTest,
  };
}

// ---------- public API ----------

export async function sendWhatsAppText(admin: Admin, args: SendTextArgs): Promise<SendResult> {
  return coreSend(admin, args, async (_channel, sessionOpen) => {
    const body = (args.body ?? "").trim();
    if (!body) return fail("Message body is empty", false);
    if (!sessionOpen && !args.dryRun) {
      return fail("The 24-hour customer-service window is closed — use an approved template", false);
    }
    return { kind: "text", message_type: "text", body };
  });
}

export async function sendWhatsAppTemplate(admin: Admin, args: SendTemplateArgs): Promise<SendResult> {
  return coreSend(admin, args, async () => {
    const language = args.language ?? "en";
    const tpl = await resolveTemplate(admin, args.tenantId, args.template, language);
    if (!tpl) return fail(`WhatsApp template '${args.template}' (${language}) not found`, false);
    if (!tpl.is_active) return fail(`WhatsApp template '${args.template}' is inactive`, false);
    if (!args.dryRun && tpl.status !== "approved") {
      return fail(`WhatsApp template '${args.template}' is not approved (status: ${tpl.status})`, false);
    }
    const { values, missing, preview } = buildTemplateValues(tpl, args.variables);
    if (missing.length) return fail(`Missing template variables: ${missing.join(", ")}`, false);
    const components = values.length
      ? [{ type: "body", parameters: values.map((v) => ({ type: "text", text: v })) }]
      : [];
    return {
      kind: "template",
      message_type: "template",
      body: preview,
      template: { id: tpl.id, name: tpl.provider_template_name ?? tpl.name, language, components, values },
    };
  });
}

export async function sendWhatsAppMedia(admin: Admin, args: SendMediaArgs): Promise<SendResult> {
  return coreSend(admin, args, async (_channel, sessionOpen) => {
    if (!args.link) return fail("A media link is required", false);
    if (!sessionOpen && !args.dryRun) {
      return fail("The 24-hour customer-service window is closed — media requires an open session", false);
    }
    return {
      kind: "media",
      message_type: args.mediaType,
      body: args.caption ?? null as any,
      media: { type: args.mediaType, link: args.link, caption: args.caption, filename: args.filename },
    };
  });
}

export async function sendWhatsAppDocument(
  admin: Admin,
  args: Omit<SendMediaArgs, "mediaType">,
): Promise<SendResult> {
  return sendWhatsAppMedia(admin, { ...args, mediaType: "document" });
}
