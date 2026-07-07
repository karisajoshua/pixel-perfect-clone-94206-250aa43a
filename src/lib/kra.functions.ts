import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KraIdType = "national_id" | "passport" | "service_id" | "alien_id";

const ID_TYPE_CODE: Record<KraIdType, string> = {
  national_id: "1",
  passport: "2",
  service_id: "3",
  alien_id: "4",
};

export type KraCheckResult =
  | { ok: true; pin: string; taxpayer_name: string; status: string; id_type: KraIdType; id_number: string }
  | { ok: false; code: "not_found" | "config" | "auth" | "error"; message: string };

// Cache the OAuth token in module scope for the lifetime of the worker.
let tokenCache: { token: string; expires_at: number } | null = null;

async function fetchToken(base: string, clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && tokenCache.expires_at - 60_000 > Date.now()) return tokenCache.token;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${base.replace(/\/$/, "")}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OAuth token failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("OAuth token missing access_token");
  tokenCache = {
    token: json.access_token,
    expires_at: Date.now() + Math.max(60, (json.expires_in ?? 3000)) * 1000,
  };
  return json.access_token;
}

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => ["admin", "manager", "agent"].includes(r))) {
    throw new Error("Forbidden");
  }
}

export const checkPinByIdNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id_number: z.string().trim().min(3).max(32),
        id_type: z.enum(["national_id", "passport", "service_id", "alien_id"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<KraCheckResult> => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);

    const base = process.env.KRA_GAVACONNECT_BASE_URL || "https://api.gavaconnect.go.ke";
    const clientId = process.env.KRA_GAVACONNECT_CLIENT_ID;
    const clientSecret = process.env.KRA_GAVACONNECT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return { ok: false, code: "config", message: "KRA GavaConnect credentials are not configured." };
    }

    let token: string;
    try {
      token = await fetchToken(base, clientId, clientSecret);
    } catch (e: any) {
      tokenCache = null;
      return { ok: false, code: "auth", message: e?.message ?? "Could not authenticate with KRA." };
    }

    const url = `${base.replace(/\/$/, "")}/checker/v1/pin-by-id`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        TaxpayerID: data.id_number.trim(),
        TaxpayerType: ID_TYPE_CODE[data.id_type],
      }),
    });

    if (res.status === 401 || res.status === 403) {
      tokenCache = null;
      return { ok: false, code: "auth", message: "KRA rejected the credentials." };
    }

    const text = await res.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* ignore */ }

    if (!res.ok) {
      const message = payload?.message || payload?.error || `KRA returned HTTP ${res.status}`;
      const code = res.status === 404 ? "not_found" : "error";
      return { ok: false, code, message: String(message).slice(0, 300) };
    }

    // Accept several shapes: { success, data: {...} } or a flat object.
    const d = payload?.data ?? payload ?? {};
    const pin = d.KRAPIN || d.PIN || d.pin || d.kraPin;
    const name = d.TaxpayerName || d.taxpayerName || d.Name || d.name;
    if (!pin) {
      return { ok: false, code: "not_found", message: payload?.message || "No KRA PIN found for that ID." };
    }

    return {
      ok: true,
      pin: String(pin),
      taxpayer_name: String(name ?? ""),
      status: String(d.Status ?? d.status ?? "Active"),
      id_type: data.id_type,
      id_number: data.id_number.trim(),
    };
  });

export const savePinVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        id_type: z.enum(["national_id", "passport", "service_id", "alien_id"]),
        pin: z.string().trim().min(3),
        taxpayer_name: z.string().default(""),
        status: z.string().default("verified"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await (supabase.from("clients") as any)
      .update({
        kra_pin: data.pin,
        kra_id_type: data.id_type,
        kra_verified_name: data.taxpayer_name || null,
        kra_verified_at: new Date().toISOString(),
        kra_verification_status: data.status,
      })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);

    await (supabase.from("audit_log") as any).insert({
      user_id: userId,
      action: "client.kra_verified",
      entity_type: "clients",
      entity_id: data.clientId,
      metadata: { pin: data.pin, id_type: data.id_type, status: data.status },
    });

    return { ok: true };
  });