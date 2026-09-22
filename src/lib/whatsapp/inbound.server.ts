/**
 * Meta WhatsApp webhook processing (server-only).
 *
 * Handles both delivery statuses (sent/delivered/read/failed) and inbound
 * messages. Every provider event is recorded once in whatsapp_webhook_events,
 * so repeated deliveries from Meta never create duplicate records.
 * Inbound messages emit a `whatsapp.message_received` automation event —
 * no AI, no chatbot (that is Phase 4).
 */
import { normalizePhone } from "@/lib/phone";
import { customerMenu, intentFromMenu, isGreeting } from "./digital-agent";
import { sendWhatsAppText } from "./gateway.server";
import {
  auditWhatsApp,
  ensureConversation,
  findChannelByPhoneNumberId,
  identifyClient,
  setConsent,
} from "./gateway.server";

type Admin = any;

const OPT_OUT_WORDS = ["stop", "unsubscribe", "opt out", "optout"];
const OPT_IN_WORDS = ["start", "subscribe", "opt in", "optin"];

/** Records an event once; returns false when it was already processed. */
async function claimEvent(
  admin: Admin,
  args: { eventId: string; kind: string; tenantId: string | null; channelId: string | null; payload: unknown },
): Promise<boolean> {
  const { error } = await admin.from("whatsapp_webhook_events").insert({
    provider: "meta_cloud",
    event_id: args.eventId,
    kind: args.kind,
    tenant_id: args.tenantId,
    channel_id: args.channelId,
    payload: args.payload as any,
  });
  if (error) {
    if (error.code === "23505") return false; // duplicate delivery
    throw new Error(error.message);
  }
  return true;
}

async function markEventProcessed(admin: Admin, eventId: string, error?: string) {
  await admin
    .from("whatsapp_webhook_events")
    .update({ processed_at: new Date().toISOString(), error: error ?? null })
    .eq("provider", "meta_cloud")
    .eq("event_id", eventId);
}

const STATUS_ORDER: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

async function handleStatus(admin: Admin, channel: any, status: any) {
  const providerId = status?.id;
  if (!providerId) return;
  const state = String(status?.status ?? "").toLowerCase();
  if (!["sent", "delivered", "read", "failed"].includes(state)) return;
  const eventId = `${providerId}:${state}`;
  const fresh = await claimEvent(admin, {
    eventId, kind: `status.${state}`, tenantId: channel?.tenant_id ?? null, channelId: channel?.id ?? null, payload: status,
  });
  if (!fresh) return;

  try {
    const { data: msg } = await admin
      .from("conversation_messages")
      .select("id, tenant_id, status")
      .eq("provider", "meta_cloud")
      .eq("provider_message_id", providerId)
      .maybeSingle();
    if (!msg) {
      await markEventProcessed(admin, eventId, "no matching message");
      return;
    }
    // Never move a message backwards (Meta can deliver events out of order).
    if ((STATUS_ORDER[state] ?? 0) < (STATUS_ORDER[msg.status] ?? 0) && msg.status !== "failed") {
      await markEventProcessed(admin, eventId);
      return;
    }
    const ts = status?.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString();
    const patch: Record<string, unknown> = { status: state };
    if (state === "sent") patch.sent_at = ts;
    if (state === "delivered") patch.delivered_at = ts;
    if (state === "read") patch.read_at = ts;
    if (state === "failed") {
      patch.failed_at = ts;
      const err = status?.errors?.[0];
      patch.error = err?.title ?? err?.message ?? "Delivery failed";
      patch.error_code = err?.code != null ? String(err.code) : null;
    }
    await admin.from("conversation_messages").update(patch).eq("id", msg.id);
    if (state === "failed") {
      await auditWhatsApp(admin, msg.tenant_id, "whatsapp.message_failed", msg.id, { provider_message_id: providerId, ...patch });
    }
    await markEventProcessed(admin, eventId);
  } catch (e: any) {
    await markEventProcessed(admin, eventId, e?.message ?? String(e));
    throw e;
  }
}

function extractBody(message: any): { type: string; body: string | null; media: any } {
  const type = String(message?.type ?? "text");
  switch (type) {
    case "text":
      return { type: "text", body: message?.text?.body ?? null, media: null };
    case "button":
      return { type: "interactive", body: message?.button?.text ?? null, media: null };
    case "interactive":
      return {
        type: "interactive",
        body: message?.interactive?.button_reply?.title ?? message?.interactive?.list_reply?.title ?? null,
        media: null,
      };
    case "image":
    case "document":
    case "audio":
    case "video":
    case "sticker":
      return { type, body: message?.[type]?.caption ?? null, media: message?.[type] ?? null };
    case "location":
      return { type: "location", body: null, media: message?.location ?? null };
    default:
      return { type: "other", body: null, media: message ?? null };
  }
}

async function handleInboundMessage(admin: Admin, channel: any, contactsByWaId: Map<string, string>, message: any) {
  const providerId = message?.id;
  if (!providerId) return;
  const eventId = providerId;
  const fresh = await claimEvent(admin, {
    eventId, kind: "message", tenantId: channel?.tenant_id ?? null, channelId: channel?.id ?? null, payload: message,
  });
  if (!fresh) return;

  try {
    if (!channel) {
      await markEventProcessed(admin, eventId, "unknown sender number — no matching agency channel");
      return;
    }
    const tenantId = channel.tenant_id as string;
    const from = normalizePhone(message?.from ? `+${String(message.from).replace(/\D/g, "")}` : null);
    if (!from) {
      await markEventProcessed(admin, eventId, "unparseable sender");
      return;
    }

    const match = await identifyClient(admin, tenantId, from);
    const conversation = await ensureConversation(admin, {
      tenantId,
      phone: from,
      channelId: channel.id,
      clientId: match.client_id,
      contactName: contactsByWaId.get(String(message.from)) ?? null,
    });

    if (conversation.identification !== match.identification && match.identification !== "unidentified") {
      await admin.from("conversations").update({ identification: match.identification }).eq("id", conversation.id);
    }

    const { type, body, media } = extractBody(message);
    const ts = message?.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString();

    const { error: insErr } = await admin.from("conversation_messages").insert({
      tenant_id: tenantId,
      conversation_id: conversation.id,
      client_id: match.client_id,
      channel: "whatsapp",
      direction: "inbound",
      message_type: type,
      body,
      media,
      provider: "meta_cloud",
      provider_message_id: providerId,
      status: "received",
      recipient: channel.display_phone_number ?? null,
      sender: from,
      payload: message,
    });
    if (insErr && insErr.code !== "23505") throw new Error(insErr.message);

    await admin.from("conversations")
      .update({ last_inbound_at: ts, last_message_at: ts, status: conversation.status === "closed" ? "open" : conversation.status })
      .eq("id", conversation.id);

    // Opt-out / opt-in keywords
    const text = (body ?? "").trim().toLowerCase();
    if (text && OPT_OUT_WORDS.includes(text)) {
      await setConsent(admin, { tenantId, phone: from, status: "opted_out", source: "whatsapp_keyword", clientId: match.client_id });
    } else if (text && OPT_IN_WORDS.includes(text)) {
      await setConsent(admin, { tenantId, phone: from, status: "opted_in", source: "whatsapp_keyword", clientId: match.client_id });
    }

    // Customer-facing digital insurance agent. Keep provider/integration details invisible.
    // Sensitive policy/vehicle information is never exposed here; protected journeys continue
    // through the verification state machine before any private data is returned.
    if (text && !OPT_OUT_WORDS.includes(text) && !OPT_IN_WORDS.includes(text) && !conversation.bot_paused) {
      const currentState = conversation.bot_state ?? "idle";
      const intent = intentFromMenu(text);
      if (isGreeting(text) || currentState === "idle") {
        const { data: tenant } = await admin.from("tenants").select("name").eq("id", tenantId).maybeSingle();
        const agencyName = tenant?.name ?? channel.display_name ?? "our insurance team";
        await sendWhatsAppText(admin, {
          tenantId, to: from, body: customerMenu(agencyName),
          clientId: match.client_id, idempotencyKey: `wa:welcome:${providerId}`,
        });
        await admin.from("conversations").update({ status: "bot", bot_state: "menu", ai_intent: null }).eq("id", conversation.id);
      } else if (currentState === "menu" && intent !== "unknown") {
        if (intent === "human") {
          await admin.from("conversations").update({ status: "escalated", bot_state: "human", bot_paused: true, ai_intent: "human" }).eq("id", conversation.id);
          await sendWhatsAppText(admin, { tenantId, to: from, body: "Thank you. A member of our team will assist you shortly.", clientId: match.client_id, idempotencyKey: `wa:human:${providerId}` });
        } else {
          const needsVehicle = ["renew_cover","new_policy","quotation","policy_status","claims"].includes(intent);
          await admin.from("conversations").update({
            status: "bot", ai_intent: intent,
            bot_state: needsVehicle ? "awaiting_registration" : "menu",
            bot_context: { ...(conversation.bot_context ?? {}), intent },
          }).eq("id", conversation.id);
          if (needsVehicle) {
            await sendWhatsAppText(admin, {
              tenantId, to: from,
              body: "Please enter the vehicle registration number (for example KAA 123A). We will verify your access before showing any private vehicle or policy information.",
              clientId: match.client_id, idempotencyKey: `wa:registration:${providerId}`,
            });
          }
        }
      }
    }

    // Automation event — Phase 4 will consume this for conversational flows.
    const { error: evErr } = await admin.from("automation_events").insert({
      tenant_id: tenantId,
      event_type: "whatsapp.message_received",
      entity_type: "conversation",
      entity_id: conversation.id,
      client_id: match.client_id,
      dedupe_key: `whatsapp:inbound:${providerId}`,
      payload: {
        conversation_id: conversation.id,
        from,
        message_type: type,
        body,
        identification: match.identification,
        provider_message_id: providerId,
      },
    });
    if (evErr && evErr.code !== "23505") throw new Error(evErr.message);

    if (match.client_id) {
      await admin.from("client_communications").insert({
        tenant_id: tenantId, client_id: match.client_id, channel: "whatsapp",
        direction: "inbound", subject: "WhatsApp message", body,
      }).then(() => undefined, () => undefined);
    }

    await markEventProcessed(admin, eventId);
  } catch (e: any) {
    await markEventProcessed(admin, eventId, e?.message ?? String(e));
    throw e;
  }
}

export async function processWhatsAppWebhook(admin: Admin, payload: any) {
  const stats = { statuses: 0, messages: 0, errors: [] as string[] };
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const phoneNumberId = value?.metadata?.phone_number_id;
      let channel: any = null;
      try {
        if (phoneNumberId) channel = await findChannelByPhoneNumberId(admin, String(phoneNumberId));
      } catch (e: any) {
        stats.errors.push(`channel lookup: ${e?.message ?? String(e)}`);
      }

      const contacts = new Map<string, string>();
      for (const c of value?.contacts ?? []) {
        if (c?.wa_id) contacts.set(String(c.wa_id), c?.profile?.name ?? "");
      }

      for (const status of value?.statuses ?? []) {
        try {
          await handleStatus(admin, channel, status);
          stats.statuses += 1;
        } catch (e: any) {
          stats.errors.push(`status: ${e?.message ?? String(e)}`);
        }
      }
      for (const message of value?.messages ?? []) {
        try {
          await handleInboundMessage(admin, channel, contacts, message);
          stats.messages += 1;
        } catch (e: any) {
          stats.errors.push(`message: ${e?.message ?? String(e)}`);
        }
      }
    }
  }
  return stats;
}
