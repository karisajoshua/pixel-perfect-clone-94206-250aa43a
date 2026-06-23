import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const updateClientBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clientId: z.string().uuid(), branchId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prev, error: pErr } = await supabaseAdmin
      .from("clients")
      .select("id, branch_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prev) throw new Error("Client not found");

    const { error } = await (supabaseAdmin.from("clients") as any)
      .update({ branch_id: data.branchId })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);

    await (supabaseAdmin.from("audit_log") as any).insert({
      actor_id: userId,
      action: "client.branch_changed",
      entity_type: "clients",
      entity_id: data.clientId,
      details: { from: prev.branch_id, to: data.branchId },
    });

    return { ok: true };
  });