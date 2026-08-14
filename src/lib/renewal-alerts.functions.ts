import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ACTIVE = ["active", "renewed", "pending"];

/** Policies expiring within 14 days (or expired within the last 7 and still active). */
export const listExpiringCovers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const day = 86400_000;
    const from = new Date(Date.now() - 7 * day).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 14 * day).toISOString().slice(0, 10);
    const { data, error } = await context.supabase
      .from("policies")
      .select("id, policy_no, end_date, status, clients(full_name, company_name, client_type), vehicles(registration_no)")
      .in("status", ACTIVE)
      .gte("end_date", from)
      .lte("end_date", to)
      .order("end_date", { ascending: true })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((p: any) => ({
      id: p.id,
      policy_no: p.policy_no,
      end_date: p.end_date,
      client_name:
        p.clients?.client_type === "corporate"
          ? p.clients?.company_name ?? p.clients?.full_name
          : p.clients?.full_name ?? "—",
      registration_no: p.vehicles?.registration_no ?? null,
    }));
  });
