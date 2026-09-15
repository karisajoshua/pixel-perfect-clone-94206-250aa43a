import { createServerFn } from "@tanstack/react-start";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";
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
      user_id: userId,
      action: "client.branch_changed",
      entity_type: "clients",
      entity_id: data.clientId,
      metadata: { from: prev.branch_id, to: data.branchId },
    });

    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client, error: cErr } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, company_name, client_type, tenant_id, branch_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!client) throw new Error("Client not found");

    // Count restrict-side dependents so we can refuse cleanly
    const [pol, inv, clm] = await Promise.all([
      supabaseAdmin.from("policies").select("id", { count: "exact", head: true }).eq("client_id", data.clientId),
      supabaseAdmin.from("invoices").select("id", { count: "exact", head: true }).eq("client_id", data.clientId),
      supabaseAdmin.from("claims").select("id", { count: "exact", head: true }).eq("client_id", data.clientId),
    ]);
    const policies = pol.count ?? 0;
    const invoices = inv.count ?? 0;
    const claims = clm.count ?? 0;
    if (policies + invoices + claims > 0) {
      const parts: string[] = [];
      if (policies) parts.push(`${policies} polic${policies === 1 ? "y" : "ies"}`);
      if (invoices) parts.push(`${invoices} invoice${invoices === 1 ? "" : "s"}`);
      if (claims) parts.push(`${claims} claim${claims === 1 ? "" : "s"}`);
      throw new Error(`Cannot delete: this client has ${parts.join(", ")}. Cancel or reassign them first.`);
    }

    const { error: delErr } = await supabaseAdmin.from("clients").delete().eq("id", data.clientId);
    if (delErr) throw new Error(delErr.message);

    await (supabaseAdmin.from("audit_log") as any).insert({
      user_id: userId,
      action: "client.deleted",
      entity_type: "clients",
      entity_id: data.clientId,
      metadata: {
        name: client.client_type === "corporate" ? (client.company_name ?? client.full_name) : client.full_name,
        tenant_id: client.tenant_id,
        branch_id: client.branch_id,
      },
    });

    return { ok: true };
  });