import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { docsAsContext } from "@/lib/docs/content";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `You are the Zest Insurance Agency in-app assistant. You help staff and clients use the agency management app and answer questions about their live data.

You have tools to query the agency database in real time. ALWAYS use a tool when the user asks anything factual about their data (counts, balances, lists, renewals, status, totals, who/what/when). Do not guess numbers. After getting tool results, summarise them concisely.

Queries respect the signed-in user's permissions (RLS), so you only ever see what they are allowed to see. If a tool returns an empty list or zero, say so plainly.

When pointing the user to a page in the app, reference the route in backticks like \`/clients\` so the UI renders a navigation button. Keep answers concise (1-4 short paragraphs, bullets or small tables when listing items).

--- APP DOCUMENTATION ---
${docsAsContext()}
--- END DOCUMENTATION ---`;

function buildTools(sb: SupabaseClient<Database>) {
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (n: number) =>
    new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

  return {
    get_overview_stats: tool({
      description:
        "High-level counts and totals across the agency: number of clients, active policies, outstanding invoice balance, open claims, and policies expiring in the next 30/60 days.",
      inputSchema: z.object({}),
      execute: async () => {
        const [clients, activePolicies, expiring30, expiring60, openClaims, invoices] =
          await Promise.all([
            sb.from("clients").select("id", { count: "exact", head: true }),
            sb.from("policies").select("id", { count: "exact", head: true }).eq("status", "active"),
            sb
              .from("policies")
              .select("id", { count: "exact", head: true })
              .eq("status", "active")
              .gte("end_date", today())
              .lte("end_date", addDays(30)),
            sb
              .from("policies")
              .select("id", { count: "exact", head: true })
              .eq("status", "active")
              .gte("end_date", today())
              .lte("end_date", addDays(60)),
            sb.from("claims").select("id", { count: "exact", head: true }).not("status", "in", "(settled,closed)"),
            sb.from("invoices").select("total,amount_paid"),
          ]);
        const outstanding = (invoices.data ?? []).reduce(
          (s: number, i: any) => s + (Number(i.total) - Number(i.amount_paid || 0)),
          0,
        );
        return {
          clients: clients.count ?? 0,
          active_policies: activePolicies.count ?? 0,
          renewals_next_30_days: expiring30.count ?? 0,
          renewals_next_60_days: expiring60.count ?? 0,
          open_claims: openClaims.count ?? 0,
          outstanding_invoice_balance: outstanding,
        };
      },
    }),

    search_clients: tool({
      description: "Search clients by name, company, email, phone, ID number or KRA PIN. Returns up to 20.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        const q = `%${query}%`;
        const { data, error } = await sb
          .from("clients")
          .select("id,full_name,company_name,client_type,email,phone,kyc_status")
          .or(
            `full_name.ilike.${q},company_name.ilike.${q},email.ilike.${q},phone.ilike.${q},id_number.ilike.${q},kra_pin.ilike.${q}`,
          )
          .limit(20);
        if (error) return { error: error.message };
        return { count: data?.length ?? 0, clients: data ?? [] };
      },
    }),

    list_policies: tool({
      description:
        "List policies. Optional filters: status (active/lapsed/cancelled), expiring_within_days, client name fragment, insurer name fragment. Returns up to 25.",
      inputSchema: z.object({
        status: z.string().optional(),
        expiring_within_days: z.number().int().positive().optional(),
        client: z.string().optional(),
        insurer: z.string().optional(),
      }),
      execute: async ({ status, expiring_within_days, client, insurer }) => {
        let q = sb
          .from("policies")
          .select(
            "id,policy_no,status,start_date,end_date,premium_gross,payment_status,clients(full_name,company_name),insurers(name,short_code)",
          )
          .order("end_date", { ascending: true })
          .limit(25);
        if (status) q = q.eq("status", status);
        if (expiring_within_days) {
          q = q.gte("end_date", today()).lte("end_date", addDays(expiring_within_days));
        }
        const { data, error } = await q;
        if (error) return { error: error.message };
        let rows = data ?? [];
        if (client) {
          const c = client.toLowerCase();
          rows = rows.filter((r: any) =>
            `${r.clients?.full_name ?? ""} ${r.clients?.company_name ?? ""}`.toLowerCase().includes(c),
          );
        }
        if (insurer) {
          const i = insurer.toLowerCase();
          rows = rows.filter((r: any) =>
            `${r.insurers?.name ?? ""} ${r.insurers?.short_code ?? ""}`.toLowerCase().includes(i),
          );
        }
        return { count: rows.length, policies: rows };
      },
    }),

    list_invoices: tool({
      description:
        "List invoices. Optional filters: status, overdue_only (past due_date with balance), client name fragment. Returns up to 25 with balance computed.",
      inputSchema: z.object({
        status: z.string().optional(),
        overdue_only: z.boolean().optional(),
        client: z.string().optional(),
      }),
      execute: async ({ status, overdue_only, client }) => {
        let q = sb
          .from("invoices")
          .select("id,invoice_no,issue_date,due_date,total,amount_paid,status,clients(full_name,company_name)")
          .order("due_date", { ascending: true })
          .limit(50);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return { error: error.message };
        let rows = (data ?? []).map((r: any) => ({
          ...r,
          balance: Number(r.total) - Number(r.amount_paid || 0),
        }));
        if (overdue_only) rows = rows.filter((r) => r.balance > 0 && r.due_date < today());
        if (client) {
          const c = client.toLowerCase();
          rows = rows.filter((r: any) =>
            `${r.clients?.full_name ?? ""} ${r.clients?.company_name ?? ""}`.toLowerCase().includes(c),
          );
        }
        return { count: rows.length, invoices: rows.slice(0, 25) };
      },
    }),

    list_claims: tool({
      description: "List claims. Optional filters: status, open_only, client name fragment. Returns up to 25.",
      inputSchema: z.object({
        status: z.string().optional(),
        open_only: z.boolean().optional(),
        client: z.string().optional(),
      }),
      execute: async ({ status, open_only, client }) => {
        let q = sb
          .from("claims")
          .select("id,claim_no,status,incident_date,claim_amount,description,clients(full_name,company_name)")
          .order("incident_date", { ascending: false })
          .limit(50);
        if (status) q = q.eq("status", status);
        if (open_only) q = q.not("status", "in", "(settled,closed)");
        const { data, error } = await q;
        if (error) return { error: error.message };
        let rows = data ?? [];
        if (client) {
          const c = client.toLowerCase();
          rows = rows.filter((r: any) =>
            `${r.clients?.full_name ?? ""} ${r.clients?.company_name ?? ""}`.toLowerCase().includes(c),
          );
        }
        return { count: rows.length, claims: rows.slice(0, 25) };
      },
    }),

    upcoming_renewals: tool({
      description: "Active policies expiring within the given number of days (default 30). Returns up to 25.",
      inputSchema: z.object({ within_days: z.number().int().positive().max(365).optional() }),
      execute: async ({ within_days }) => {
        const n = within_days ?? 30;
        const { data, error } = await sb
          .from("policies")
          .select("id,policy_no,end_date,premium_gross,clients(full_name,company_name),insurers(name)")
          .eq("status", "active")
          .gte("end_date", today())
          .lte("end_date", addDays(n))
          .order("end_date", { ascending: true })
          .limit(25);
        if (error) return { error: error.message };
        return { count: data?.length ?? 0, within_days: n, policies: data ?? [] };
      },
    }),

    recent_payments: tool({
      description: "Most recent payments recorded against invoices. Returns up to 20.",
      inputSchema: z.object({ limit: z.number().int().positive().max(50).optional() }),
      execute: async ({ limit }) => {
        const { data, error } = await sb
          .from("payments")
          .select("id,amount,method,reference,paid_at,invoices(invoice_no,clients(full_name,company_name))")
          .order("paid_at", { ascending: false })
          .limit(limit ?? 20);
        if (error) return { error: error.message };
        return { count: data?.length ?? 0, payments: data ?? [] };
      },
    }),
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Supabase env missing", { status: 500 });
        }

        // Attach the caller's bearer token so all DB queries run under their RLS.
        const authHeader = request.headers.get("authorization") ?? "";
        const sb = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: authHeader ? { Authorization: authHeader } : {} },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          tools: buildTools(sb),
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});