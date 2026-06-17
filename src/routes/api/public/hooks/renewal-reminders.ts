import { createFileRoute } from "@tanstack/react-router";

// Daily renewal-reminder engine.
// Scans policies expiring in 60/30/14/7/1 day windows and enqueues a row in
// public.notifications for each (clientEmail, policy, window) pair, unless an
// equivalent reminder was already queued for that policy + window.
export const Route = createFileRoute("/api/public/hooks/renewal-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const windows = [60, 30, 14, 7, 1];
        const today = new Date();
        let queued = 0;
        const errors: string[] = [];

        for (const days of windows) {
          const target = new Date(today); target.setDate(today.getDate() + days);
          const dateStr = target.toISOString().slice(0, 10);
          const { data: policies, error } = await supabaseAdmin
            .from("policies")
            .select("id, policy_no, end_date, client_id, branch_id, clients(full_name, company_name, client_type, email, phone)")
            .eq("end_date", dateStr)
            .in("status", ["active", "pending"]);
          if (error) { errors.push(`fetch ${days}d: ${error.message}`); continue; }

          for (const p of policies ?? []) {
            const cl: any = (p as any).clients;
            if (!cl?.email && !cl?.phone) continue;
            const name = cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name;
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

            const { error: insErr } = await supabaseAdmin.from("notifications").insert({
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
            });
            if (insErr) errors.push(insErr.message); else queued += 1;
          }
        }

        return Response.json({ ok: true, queued, errors });
      },
    },
  },
});