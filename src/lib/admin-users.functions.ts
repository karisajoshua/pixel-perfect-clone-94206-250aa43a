import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

async function assertAdminOrManager(supabase: any, userId: string) {
  for (const r of ["admin", "manager"] as const) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) return;
  }
  throw new Error("Forbidden: admin or manager role required");
}

function generatePassword(len = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789";
  const sym = "!@#$%&*";
  const all = upper + lower + nums + sym;
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += all[bytes[i] % all.length];
  // ensure at least one of each
  return upper[bytes[0] % upper.length] + lower[bytes[1] % lower.length] + nums[bytes[2] % nums.length] + sym[bytes[3] % sym.length] + out.slice(4);
}

export const createClientPortalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ client_id: z.string().uuid(), phone: z.string().trim().min(1).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdminOrManager(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client, error: cErr } = await supabaseAdmin
      .from("clients")
      .select("id, email, phone, full_name, auth_user_id")
      .eq("id", data.client_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!client) throw new Error("Client not found");
    if (client.auth_user_id) throw new Error("This client already has a portal login");

    // Prefer phone (from client or supplied by staff); fall back to email
    const suppliedPhone = normalizePhone(data.phone ?? null);
    const storedPhone = normalizePhone(client.phone ?? null);
    const phone = suppliedPhone ?? storedPhone;
    const email = client.email ?? null;

    if (!phone && !email) {
      throw new Error("Add a phone number or email for this client before creating a portal login");
    }

    // If staff supplied a new phone, persist it on the client record
    if (suppliedPhone && suppliedPhone !== storedPhone) {
      await supabaseAdmin.from("clients").update({ phone: suppliedPhone }).eq("id", client.id);
    }

    // Look for an existing auth user by phone first, then email
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const found = existing?.users?.find((u: any) => {
      if (phone && u.phone && ("+" + String(u.phone).replace(/\D/g, "")) === phone) return true;
      if (email && (u.email ?? "").toLowerCase() === email.toLowerCase()) return true;
      return false;
    });
    if (found) {
      await supabaseAdmin.from("clients").update({ auth_user_id: found.id }).eq("id", client.id);
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: found.id, role: "client" as any }, { onConflict: "user_id,role" });
      return { email, phone, password: null as string | null, linked: true };
    }

    const password = generatePassword(14);
    const createPayload: any = {
      password,
      user_metadata: { full_name: client.full_name ?? "" },
    };
    if (phone) {
      createPayload.phone = phone;
      createPayload.phone_confirm = true;
    }
    if (email) {
      createPayload.email = email;
      createPayload.email_confirm = true;
    }
    const { data: created, error: aErr } = await supabaseAdmin.auth.admin.createUser(createPayload);
    if (aErr || !created.user) throw new Error(aErr?.message ?? "Could not create user");

    await supabaseAdmin.from("clients").update({ auth_user_id: created.user.id }).eq("id", client.id);
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "client" as any }, { onConflict: "user_id,role" });

    return { email, phone, password, linked: false };
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; fullName?: string | null; email?: string | null; phone?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const profileUpdate: { full_name?: string | null; email?: string | null; phone?: string | null } = {};
    if (data.fullName !== undefined) profileUpdate.full_name = data.fullName;
    if (data.email !== undefined) profileUpdate.email = data.email;
    if (data.phone !== undefined) profileUpdate.phone = data.phone;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: pErr } = await (supabaseAdmin.from("profiles") as any).update(profileUpdate).eq("id", data.userId);
      if (pErr) throw new Error(pErr.message);
    }

    if (data.email) {
      const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: data.email });
      if (aErr) throw new Error(aErr.message);
    }

    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    if (data.userId === userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });