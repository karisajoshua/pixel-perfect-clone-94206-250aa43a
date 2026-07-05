import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startMySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_agent: z.string().max(500).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("user_sessions")
      .insert({ user_id: context.userId, user_agent: data.user_agent ?? null } as any)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id as string };
  });

export const heartbeatMySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const endMySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("user_sessions")
      .update({ ended_at: now, last_seen_at: now })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .is("ended_at", null);
    if (error) throw error;
    return { ok: true };
  });

export const listStaffSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        role: z.enum(["admin", "manager", "agent", "viewer"]).optional(),
        user_id: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const fromIso = data.from ? new Date(data.from).toISOString() : new Date(Date.now() - 30 * 86400_000).toISOString();
    const toIso = data.to ? new Date(data.to).toISOString() : new Date().toISOString();
    const targetRole = data.role ?? "manager";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", targetRole);
    if (rErr) throw rErr;
    let userIds = (roleRows ?? []).map((r: any) => r.user_id as string);
    if (data.user_id) userIds = userIds.filter((u) => u === data.user_id);
    if (userIds.length === 0) return { sessions: [], totals: [] };

    const { data: sessions, error: sErr } = await supabaseAdmin
      .from("user_sessions")
      .select("id, user_id, started_at, ended_at, last_seen_at, user_agent")
      .in("user_id", userIds)
      .gte("started_at", fromIso)
      .lte("started_at", toIso)
      .order("started_at", { ascending: false });
    if (sErr) throw sErr;

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, branch_id, branches(name)")
      .in("id", userIds);
    const profileMap = new Map<string, any>();
    for (const p of profiles ?? []) profileMap.set(p.id as string, p);

    const enriched = (sessions ?? []).map((s: any) => {
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.ended_at ?? s.last_seen_at).getTime();
      const duration_seconds = Math.max(0, Math.round((end - start) / 1000));
      const profile = profileMap.get(s.user_id);
      return {
        ...s,
        duration_seconds,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        branch_name: profile?.branches?.name ?? null,
      };
    });

    const totalsMap = new Map<string, { user_id: string; full_name: string | null; email: string | null; branch_name: string | null; total_seconds: number; session_count: number }>();
    for (const s of enriched) {
      const cur = totalsMap.get(s.user_id) ?? {
        user_id: s.user_id,
        full_name: s.full_name,
        email: s.email,
        branch_name: s.branch_name,
        total_seconds: 0,
        session_count: 0,
      };
      cur.total_seconds += s.duration_seconds;
      cur.session_count += 1;
      totalsMap.set(s.user_id, cur);
    }

    return { sessions: enriched, totals: Array.from(totalsMap.values()).sort((a, b) => b.total_seconds - a.total_seconds) };
  });