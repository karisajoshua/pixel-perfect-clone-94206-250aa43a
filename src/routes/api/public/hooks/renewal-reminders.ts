import { createFileRoute } from "@tanstack/react-router";
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

async function getOrCreateUnsubscribeToken(
  supabase: any,
  email: string,
): Promise<string | null> {
  const normalized = email.toLowerCase();
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (existing && !existing.used_at) return existing.token;
  if (existing && existing.used_at) return null; // unsubscribed
  const token = generateToken();
  await supabase
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
  const { data: stored } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  return stored?.token ?? token;
}

// Daily renewal-reminder engine.
// Scans policies expiring in 60/30/14/7/1 day windows, enqueues a notification
// row for tracking, and dispatches an email via the Lovable email queue.
export const Route = createFileRoute("/api/public/hooks/renewal-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const tpl = TEMPLATES["renewal-reminder"];
        if (!tpl) {
          return Response.json({ ok: false, error: "renewal-reminder template missing" }, { status: 500 });
        }

        const windows = [60, 30, 14, 7, 1];
        const today = new Date();
        let queued = 0;
        let dispatched = 0;
        const errors: string[] = [];

        for (const days of windows) {
          const target = new Date(today);
          target.setDate(today.getDate() + days);
          const dateStr = target.toISOString().slice(0, 10);
          const { data: policies, error } = await supabaseAdmin
            .from("policies")
            .select(
              "id, policy_no, end_date, client_id, branch_id, clients(full_name, company_name, client_type, email, phone)",
            )
            .eq("end_date", dateStr)
            .in("status", ["active", "pending"]);
          if (error) {
            errors.push(`fetch ${days}d: ${error.message}`);
            continue;
          }

          for (const p of policies ?? []) {
            const cl: any = (p as any).clients;
            if (!cl?.email && !cl?.phone) continue;
            const name =
              cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name;
            const subject = `Policy ${p.policy_no} renews in ${days} day${days === 1 ? "" : "s"}`;
            const body = `Hi ${name},\n\nThis is a reminder that your policy ${p.policy_no} expires on ${p.end_date}. Please reach out to renew on time and avoid lapses in cover.\n\nZest Insurance`;

            // Dedupe: skip if we already queued this exact reminder for this policy + window.
            const { data: existing } = await supabaseAdmin
              .from("notifications")
              .select("id")
              .eq("entity_type", "policy")
              .eq("entity_id", p.id)
              .eq("kind", `renewal_reminder_${days}d`)
              .limit(1);
            if (existing && existing.length > 0) continue;

            const { data: notif, error: insErr } = await supabaseAdmin
              .from("notifications")
              .insert({
                kind: `renewal_reminder_${days}d`,
                entity_type: "policy",
                entity_id: p.id,
                client_id: p.client_id,
                recipient_email: cl.email,
                recipient_phone: cl.phone,
                channel: cl.email ? "email" : "sms",
                status: "queued",
                subject,
                body,
                payload: { policy_no: p.policy_no, end_date: p.end_date, days_to_expiry: days },
              })
              .select("id")
              .single();
            if (insErr) {
              errors.push(insErr.message);
              continue;
            }
            queued += 1;

            // Dispatch via Lovable email queue (only if we have an email address).
            if (!cl.email) continue;
            try {
              const data = {
                clientName: name,
                policyNo: p.policy_no,
                endDate: p.end_date,
                daysToExpiry: days,
              };
              const element = React.createElement(tpl.component, data);
              const html = await render(element);
              const text = await render(element, { plainText: true });
              const resolvedSubject =
                typeof tpl.subject === "function" ? tpl.subject(data) : tpl.subject;

              // Suppression check
              const { data: suppressed } = await supabaseAdmin
                .from("suppressed_emails")
                .select("id")
                .eq("email", cl.email.toLowerCase())
                .maybeSingle();
              if (suppressed) {
                await supabaseAdmin
                  .from("notifications")
                  .update({ status: "suppressed", sent_at: new Date().toISOString() })
                  .eq("id", notif.id);
                continue;
              }

              const unsubscribeToken = await getOrCreateUnsubscribeToken(supabaseAdmin, cl.email);
              if (!unsubscribeToken) {
                await supabaseAdmin
                  .from("notifications")
                  .update({ status: "suppressed", sent_at: new Date().toISOString() })
                  .eq("id", notif.id);
                continue;
              }

              const messageId = crypto.randomUUID();
              await supabaseAdmin.from("email_send_log").insert({
                message_id: messageId,
                template_name: "renewal-reminder",
                recipient_email: cl.email,
                status: "pending",
              });

              const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", {
                queue_name: "transactional_emails",
                payload: {
                  message_id: messageId,
                  to: cl.email,
                  from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
                  sender_domain: SENDER_DOMAIN,
                  subject: resolvedSubject,
                  html,
                  text,
                  purpose: "transactional",
                  label: "renewal-reminder",
                  idempotency_key: `renewal-${p.id}-${days}d`,
                  unsubscribe_token: unsubscribeToken,
                  queued_at: new Date().toISOString(),
                },
              });

              if (enqErr) {
                errors.push(`enqueue ${p.policy_no}: ${enqErr.message}`);
                await supabaseAdmin
                  .from("notifications")
                  .update({ status: "failed", error: enqErr.message })
                  .eq("id", notif.id);
              } else {
                dispatched += 1;
                await supabaseAdmin
                  .from("notifications")
                  .update({ status: "sent", sent_at: new Date().toISOString() })
                  .eq("id", notif.id);
              }
            } catch (e: any) {
              errors.push(`dispatch ${p.policy_no}: ${e?.message ?? String(e)}`);
              await supabaseAdmin
                .from("notifications")
                .update({ status: "failed", error: e?.message ?? String(e) })
                .eq("id", notif.id);
            }
          }
        }

        return Response.json({ ok: true, queued, dispatched, errors });
      },
    },
  },
});
