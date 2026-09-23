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
      // Process this inbound message against the state it arrived in. A state
      // transition caused by this message must not consume the same message again.
      const intent = intentFromMenu(text);
      if (isGreeting(text) || currentState === "idle") {
        const { data: tenant } = await admin.from("tenants").select("name").eq("id", tenantId).maybeSingle();
        const agencyName = tenant?.name ?? channel.display_name ?? "our insurance team";
        await sendWhatsAppText(admin, {
          tenantId, to: from, body: customerMenu(agencyName),
          clientId: match.client_id, idempotencyKey: `wa:welcome:${providerId}`,
        });
        await admin.from("conversations").update({ status: "bot", bot_state: "menu", ai_intent: null }).eq("id", conversation.id);
      } else if (intent === "human") {
        await admin.from("conversations").update({ status: "escalated", bot_state: "human", bot_paused: true, ai_intent: "human" }).eq("id", conversation.id);
        await sendWhatsAppText(admin, { tenantId, to: from, body: "Thank you. A member of our team will assist you shortly.", clientId: match.client_id, idempotencyKey: `wa:human:${providerId}` });
      } else if (currentState === "menu" && intent !== "unknown") {
        {
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

    // Continue protected vehicle journey after the menu.
    const latestState = (await admin.from("conversations").select("bot_state,bot_context,client_id").eq("id",conversation.id).maybeSingle()).data;
    const stateAtInbound = conversation.bot_state ?? "idle";
    if (text && stateAtInbound === "awaiting_registration") {
      const registration=text.toUpperCase().replace(/[^A-Z0-9]/g,"");
      if (/^[A-Z0-9]{5,10}$/.test(registration)) {
        const {data:vehicle}=await admin.from("vehicles").select("id,client_id,registration_no,clients!inner(tenant_id)")
          .eq("clients.tenant_id",tenantId).ilike("registration_no",registration).maybeSingle();
        // Never reveal whether an unrelated registration exists in this agency.
        if (!vehicle || !match.client_id || vehicle.client_id !== match.client_id) {
          await sendWhatsAppText(admin,{tenantId,to:from,body:"We could not verify that vehicle against this WhatsApp number. Check the registration and try again, or reply AGENT for assistance.",clientId:match.client_id,idempotencyKey:`wa:vehicle-unverified:${providerId}`});
        } else {
          const {createWhatsAppOtp}=await import("./verification.server");
          const challenge=await createWhatsAppOtp(admin,{tenantId,conversationId:conversation.id,clientId:match.client_id,vehicleId:vehicle.id,phone:from});
          // The OTP is intentionally sent only to the already matched registered WhatsApp contact.
          await sendWhatsAppText(admin,{tenantId,to:from,body:`Your verification code is ${challenge.otp}. It expires in 10 minutes. Do not share this code with anyone.`,clientId:match.client_id,idempotencyKey:`wa:otp:${challenge.id}`});
          await admin.from("conversations").update({bot_state:"awaiting_otp",bot_context:{...(latestState.bot_context??{}),vehicle_id:vehicle.id,registration_no:vehicle.registration_no}}).eq("id",conversation.id);
        }
      } else {
        await sendWhatsAppText(admin,{tenantId,to:from,body:"Please enter a valid vehicle registration number, for example KAA 123A.",clientId:match.client_id,idempotencyKey:`wa:bad-registration:${providerId}`});
      }
    } else if (text && stateAtInbound === "awaiting_otp" && /^\d{6}$/.test(text)) {
      const {verifyWhatsAppOtp}=await import("./verification.server");
      const verified=await verifyWhatsAppOtp(admin,{tenantId,conversationId:conversation.id,otp:text});
      if (!verified.ok) {
        await sendWhatsAppText(admin,{tenantId,to:from,body:verified.reason ?? "Verification failed. Please request a new code.",clientId:match.client_id,idempotencyKey:`wa:otp-failed:${providerId}`});
      } else {
        const intent=latestState.bot_context?.intent;
        const {data:policy}=await admin.from("policies")
          .select("id,policy_no,cover_type,premium_gross,start_date,end_date,status,payment_status,insurers(name)")
          .eq("client_id",match.client_id).eq("vehicle_id",verified.challenge.vehicle_id)
          .order("end_date",{ascending:false}).limit(1).maybeSingle();
        const nextContext={...(latestState.bot_context??{}),verified_at:new Date().toISOString(),policy_id:policy?.id??null};
        await admin.from("conversations").update({bot_state:"verified",identification:"identified",bot_context:nextContext}).eq("id",conversation.id);
        const coverLabel=String(policy?.cover_type??"").replace(/_/g," ");
        const policySummary = policy
          ? `We found your ${coverLabel || "motor"} cover ending ${policy.end_date}. Reply CONTINUE to view the available cover and price options, or AGENT for assistance.`
          : intent === "renew_cover" || intent === "policy_status"
            ? "Verification successful, but we could not find an eligible policy for this vehicle. Reply AGENT and our team will assist you."
            : "Verification successful. Reply CONTINUE to view the available cover and price options, or AGENT for assistance.";
        await sendWhatsAppText(admin,{tenantId,to:from,body:policySummary,clientId:match.client_id,idempotencyKey:`wa:verified:${verified.challenge.id}`});
        await admin.from("automation_events").insert({tenant_id:tenantId,event_type:"whatsapp.customer_verified",entity_type:"conversation",entity_id:conversation.id,client_id:match.client_id,dedupe_key:`whatsapp:verified:${verified.challenge.id}`,payload:{conversation_id:conversation.id,vehicle_id:verified.challenge.vehicle_id,intent:latestState.bot_context?.intent}});
      }
    }

    // Continue a verified journey using the agency's own quotation/pricing records.
    // Only final client-facing prices are shown; insurer base price and provider details stay internal.
    if (text && stateAtInbound === "verified" && ["continue","1","yes","proceed"].includes(text)) {
      const ctx = latestState?.bot_context ?? {};
      const verifiedAt = ctx.verified_at ? new Date(ctx.verified_at).getTime() : 0;
      const verificationFresh = verifiedAt > 0 && Date.now() - verifiedAt <= 15 * 60_000;
      if (!verificationFresh) {
        await admin.from("conversations").update({ bot_state: "awaiting_registration", bot_context: { intent: ctx.intent } }).eq("id", conversation.id);
        await sendWhatsAppText(admin,{tenantId,to:from,body:"For your security, verification has expired. Please enter the vehicle registration number again.",clientId:match.client_id,idempotencyKey:`wa:verification-expired:${providerId}`});
      } else {
        const {data:quotes,error:qErr}=await admin.from("quotations")
          .select("id,quote_no,cover_type,policy_term,quoted_premium,premium_gross,valid_until,status,insurers(name)")
          .eq("client_id",match.client_id).eq("vehicle_id",ctx.vehicle_id)
          .in("status",["draft","approved","sent","accepted"])
          .order("created_at",{ascending:false}).limit(5);
        if (qErr) throw new Error(qErr.message);
        const today=new Date().toISOString().slice(0,10);
        const eligible=(quotes??[]).filter((q:any)=>!q.valid_until || q.valid_until>=today);
        if (!eligible.length) {
          await sendWhatsAppText(admin,{tenantId,to:from,body:"We do not yet have a current price option ready for this vehicle. A member of our team can prepare it for you. Reply AGENT for assistance.",clientId:match.client_id,idempotencyKey:`wa:no-price:${providerId}`});
        } else {
          const options=eligible.map((q:any,i:number)=>{
            const price=Number(q.quoted_premium ?? q.premium_gross ?? 0);
            const cover=String(q.cover_type??"motor cover").replace(/_/g," ");
            return `${i+1}. ${cover} — KES ${price.toLocaleString("en-KE")}`;
          }).join("\n");
          await admin.from("conversations").update({bot_state:"selecting_cover",bot_context:{...ctx,quote_options:eligible.map((q:any)=>q.id)}}).eq("id",conversation.id);
          await sendWhatsAppText(admin,{tenantId,to:from,body:`Here are the available cover options for your vehicle:\n\n${options}\n\nReply with the option number to continue.`,clientId:match.client_id,idempotencyKey:`wa:cover-options:${providerId}`});
        }
      }
    } else if (text && stateAtInbound === "selecting_cover" && /^\d+$/.test(text)) {
      const ctx=latestState?.bot_context ?? {};
      const ids=Array.isArray(ctx.quote_options)?ctx.quote_options:[];
      const quoteId=ids[Number(text)-1];
      if (!quoteId) {
        await sendWhatsAppText(admin,{tenantId,to:from,body:"Please reply with one of the option numbers shown above, or reply AGENT for assistance.",clientId:match.client_id,idempotencyKey:`wa:bad-cover-option:${providerId}`});
      } else {
        const {data:q,error:qErr}=await admin.from("quotations")
          .select("id,quote_no,client_id,vehicle_id,cover_type,policy_term,quoted_premium,premium_gross,valid_until,status")
          .eq("id",quoteId).eq("client_id",match.client_id).eq("vehicle_id",ctx.vehicle_id).maybeSingle();
        if (qErr) throw new Error(qErr.message);
        if (!q) {
          await sendWhatsAppText(admin,{tenantId,to:from,body:"That option is no longer available. Reply CONTINUE to refresh the available options.",clientId:match.client_id,idempotencyKey:`wa:quote-unavailable:${providerId}`});
        } else {
          const price=Number(q.quoted_premium ?? q.premium_gross ?? 0);
          const cover=String(q.cover_type??"motor cover").replace(/_/g," ");
          await admin.from("conversations").update({bot_state:"awaiting_payment",bot_context:{...ctx,selected_quote_id:q.id,selected_price:price}}).eq("id",conversation.id);
          await sendWhatsAppText(admin,{tenantId,to:from,body:`You selected ${cover} at KES ${price.toLocaleString("en-KE")}. Your cover will only be issued after payment is confirmed. Reply PAY to continue or AGENT for assistance.`,clientId:match.client_id,idempotencyKey:`wa:quote-selected:${providerId}`});
          await admin.from("automation_events").insert({tenant_id:tenantId,event_type:"whatsapp.cover_selected",entity_type:"quotation",entity_id:q.id,client_id:match.client_id,dedupe_key:`whatsapp:cover-selected:${providerId}`,payload:{conversation_id:conversation.id,vehicle_id:ctx.vehicle_id,quotation_id:q.id,amount:price,intent:ctx.intent}});
        }
      }
    }

    // Provider-neutral payment handoff. PAY requests a payment transaction;
    // the configured tenant payment adapter is responsible for initiating it.
    // A customer message is never proof of payment.
    if (text && stateAtInbound === "awaiting_payment" && ["pay","1","yes","proceed"].includes(text)) {
      const ctx=latestState?.bot_context ?? {};
      if (!ctx.selected_quote_id || !ctx.selected_price) {
        await sendWhatsAppText(admin,{tenantId,to:from,body:"Your selected cover could not be confirmed. Reply CONTINUE to choose the cover again.",clientId:match.client_id,idempotencyKey:`wa:payment-missing-selection:${providerId}`});
      } else {
        const {data:q,error:qErr}=await admin.from("quotations")
          .select("id,client_id,vehicle_id,quoted_premium,premium_gross,status")
          .eq("id",ctx.selected_quote_id).eq("client_id",match.client_id).eq("vehicle_id",ctx.vehicle_id).maybeSingle();
        if (qErr) throw new Error(qErr.message);
        const amount=Number(q?.quoted_premium ?? q?.premium_gross ?? 0);
        if (!q || amount<=0) {
          await sendWhatsAppText(admin,{tenantId,to:from,body:"We could not prepare this payment automatically. Reply AGENT and our team will assist you.",clientId:match.client_id,idempotencyKey:`wa:payment-not-ready:${providerId}`});
        } else {
          await admin.from("automation_events").insert({
            tenant_id:tenantId,event_type:"payment.requested",entity_type:"quotation",entity_id:q.id,
            client_id:match.client_id,dedupe_key:`whatsapp:payment-requested:${providerId}`,
            payload:{source:"whatsapp",conversation_id:conversation.id,vehicle_id:ctx.vehicle_id,quotation_id:q.id,amount,currency:"KES",phone:from}
          });
          await admin.from("conversations").update({bot_state:"processing",bot_context:{...ctx,payment_requested_at:new Date().toISOString()}}).eq("id",conversation.id);
          await sendWhatsAppText(admin,{tenantId,to:from,body:`Your payment request for KES ${amount.toLocaleString("en-KE")} is being prepared. Complete payment only through the official payment prompt or link sent by the agency. We will confirm payment automatically before issuing your cover.`,clientId:match.client_id,idempotencyKey:`wa:payment-request:${providerId}`});
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
