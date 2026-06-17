import { supabase } from "@/integrations/supabase/client";

export type SendArgs = {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, any>;
};

/**
 * Fire a branded transactional email. Safe to call from any client component.
 * Failures are logged but never thrown — email sending must not break user flows.
 */
export async function sendTransactionalEmail(args: SendArgs): Promise<void> {
  try {
    if (!args.recipientEmail) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch("/lovable/email/transactional/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(args),
    });
  } catch (e) {
    console.warn("sendTransactionalEmail failed", e);
  }
}

export function clientDisplayName(c: { full_name?: string | null; company_name?: string | null; client_type?: string | null } | null | undefined): string {
  if (!c) return "Valued Client";
  if (c.client_type === "corporate" && c.company_name) return c.company_name;
  return c.full_name || c.company_name || "Valued Client";
}

export function formatKES(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "KES 0";
  return `KES ${v.toLocaleString()}`;
}