import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "Zest Insurance";
const SENDER_DOMAIN = "notify.zestinsurance.co.ke";
const FROM_DOMAIN = "zestinsurance.co.ke";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getOrCreateUnsubscribeToken(supabase: any, email: string): Promise<string | null> {
  const normalized = email.toLowerCase();
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens").select("token, used_at").eq("email", normalized).maybeSingle();
  if (existing && !existing.used_at) return existing.token;
  if (existing && existing.used_at) return null;
  const token = generateToken();
  await supabase.from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
  const { data: stored } = await supabase
    .from("email_unsubscribe_tokens").select("token").eq("email", normalized).maybeSingle();
  return stored?.token ?? token;
}

export type EmailResult =
  | { ok: true; message_id: string; skipped?: false }
  | { ok: true; skipped: true; reason: "suppressed" | "unsubscribed" }
  | { ok: false; error: string; retryable: boolean };

/**
 * Sends a templated email through the existing transactional pipeline
 * (suppression list → unsubscribe token → email_send_log → pgmq transactional_emails).
 * `idempotencyKey` is passed to the queue so a retried step never double-sends.
 */
export async function sendTemplatedEmail(
  supabaseAdmin: any,
  args: { template: string; to: string; data: Record<string, unknown>; idempotencyKey: string; label?: string },
): Promise<EmailResult> {
  const tpl = TEMPLATES[args.template];
  if (!tpl) return { ok: false, error: `Unknown email template '${args.template}'`, retryable: false };
  const to = (tpl.to || args.to || "").trim();
  if (!to || !to.includes("@")) return { ok: false, error: "Recipient email is missing or invalid", retryable: false };

  const { data: suppressed, error: supErr } = await supabaseAdmin
    .from("suppressed_emails").select("id").eq("email", to.toLowerCase()).maybeSingle();
  if (supErr) return { ok: false, error: `Suppression check failed: ${supErr.message}`, retryable: true };
  if (suppressed) return { ok: true, skipped: true, reason: "suppressed" };

  const unsubscribeToken = await getOrCreateUnsubscribeToken(supabaseAdmin, to);
  if (!unsubscribeToken) return { ok: true, skipped: true, reason: "unsubscribed" };

  let html: string, text: string, subject: string;
  try {
    const element = React.createElement(tpl.component, args.data);
    html = await render(element);
    text = await render(element, { plainText: true });
    subject = typeof tpl.subject === "function" ? tpl.subject(args.data as any) : tpl.subject;
  } catch (e: any) {
    return { ok: false, error: `Template render failed: ${e?.message ?? String(e)}`, retryable: false };
  }

  const messageId = crypto.randomUUID();
  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: args.template,
    recipient_email: to,
    status: "pending",
    metadata: { source: "automation", idempotency_key: args.idempotencyKey },
  });

  const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: args.label ?? `automation:${args.template}`,
      idempotency_key: args.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });
  if (enqErr) {
    await supabaseAdmin.from("email_send_log")
      .update({ status: "failed", error_message: enqErr.message }).eq("message_id", messageId);
    return { ok: false, error: `Queue failed: ${enqErr.message}`, retryable: true };
  }
  return { ok: true, message_id: messageId };
}
