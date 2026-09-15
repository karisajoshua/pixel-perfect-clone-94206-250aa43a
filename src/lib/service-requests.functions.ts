import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";

async function getMyClient(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, branch_id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No client record linked to your account.");
  return data;
}

export const submitServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        request_type: z.enum(["renewal", "cancellation", "info", "callback"]),
        policy_id: z.string().uuid().optional().nullable(),
        preferred_contact: z.enum(["email", "phone", "whatsapp", "sms"]).default("email"),
        reason: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("service_requests")
      .insert({
        client_id: client.id,
        branch_id: client.branch_id,
        policy_id: data.policy_id || null,
        request_type: data.request_type,
        preferred_contact: data.preferred_contact,
        reason: data.reason || null,
      } as any)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const listMyServiceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("service_requests")
      .select("*, policies(policy_no)")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const listAllServiceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("service_requests")
      .select("*, clients(full_name, company_name, client_type, email, phone), policies(policy_no)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

export const updateServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "resolved", "rejected"]),
        note: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: any = { status: data.status };
    if (data.status === "resolved" || data.status === "rejected") {
      patch.resolved_by = context.userId;
      patch.resolved_at = new Date().toISOString();
    }
    if (data.note) patch.reason = data.note;
    const { error } = await context.supabase.from("service_requests").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });