import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Server-only IPEN HTTP client. All calls tunnel through here so the
// per-user access token never leaves the server. On 401 we transparently
// try /api/Auth/refresh-token and re-persist the new tokens.

export type IpenFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  // Skip attaching the caller's IPEN bearer (login/refresh endpoints).
  noAuth?: boolean;
};

export type IpenResponse<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

function baseUrl(): string {
  const raw = process.env.IPEN_API_BASE_URL;
  if (!raw) throw new Error("IPEN_API_BASE_URL is not configured");
  return raw.replace(/\/$/, "");
}

function buildUrl(path: string, query?: IpenFetchOptions["query"]): string {
  const url = new URL(baseUrl() + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function rawFetch<T>(
  path: string,
  init: RequestInit,
  query?: IpenFetchOptions["query"],
): Promise<IpenResponse<T>> {
  const res = await fetch(buildUrl(path, query), init);
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.title || data.error)) ||
      (typeof data === "string" ? data : `IPEN ${res.status}`);
    return { ok: false, status: res.status, data, error: String(msg) };
  }
  return { ok: true, status: res.status, data: data as T };
}

type CredRow = {
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

async function loadCredentials(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CredRow | null> {
  const { data, error } = await supabase
    .from("ipen_credentials")
    .select("user_id, access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CredRow | null) ?? null;
}

async function persistTokens(
  supabase: SupabaseClient<Database>,
  userId: string,
  tokens: { accessToken?: string; refreshToken?: string; expiresIn?: number | null },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (tokens.accessToken) patch.access_token = tokens.accessToken;
  if (tokens.refreshToken) patch.refresh_token = tokens.refreshToken;
  if (tokens.expiresIn) {
    patch.token_expires_at = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("ipen_credentials").update(patch).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// Best-effort extraction of tokens from the varied shapes IPEN uses
// (LoginResponse / RefreshTokenResponse). We accept snake_case or camelCase.
export function extractTokens(payload: any): {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number | null;
  mfaToken?: string;
  mfaRequired?: boolean;
} {
  if (!payload || typeof payload !== "object") return {};
  const p = payload.data ?? payload;
  return {
    accessToken: p.accessToken ?? p.access_token ?? p.token,
    refreshToken: p.refreshToken ?? p.refresh_token,
    expiresIn: p.expiresIn ?? p.expires_in ?? null,
    mfaToken: p.mfaToken ?? p.mfa_token,
    mfaRequired: p.mfaRequired ?? p.mfa_required ?? Boolean(p.mfaToken ?? p.mfa_token),
  };
}

/**
 * Call the IPEN API using the current user's stored bearer.
 * Auto-refreshes on 401 and persists new tokens.
 */
export async function ipenFetch<T = any>(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: IpenFetchOptions,
): Promise<IpenResponse<T>> {
  const method = opts.method ?? (opts.body ? "POST" : "GET");
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }

  if (opts.noAuth) {
    return rawFetch<T>(opts.path, init, opts.query);
  }

  const creds = await loadCredentials(supabase, userId);
  if (!creds?.access_token) {
    return {
      ok: false,
      status: 401,
      data: null,
      error: "IPEN account not connected. Connect it in Admin → IPEN.",
    };
  }
  headers.Authorization = `Bearer ${creds.access_token}`;

  let res = await rawFetch<T>(opts.path, init, opts.query);
  if (res.status !== 401) return res;

  // Try refresh once.
  if (!creds.refresh_token) return res;
  const refresh = await rawFetch<any>(
    "/api/Auth/refresh-token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken: creds.refresh_token }),
    },
  );
  if (!refresh.ok) return res;
  const t = extractTokens(refresh.data);
  if (!t.accessToken) return res;
  await persistTokens(supabase, userId, t);
  headers.Authorization = `Bearer ${t.accessToken}`;
  res = await rawFetch<T>(opts.path, init, opts.query);
  return res;
}

/**
 * Public (no-auth) IPEN call.
 */
export async function ipenPublic<T = any>(opts: IpenFetchOptions): Promise<IpenResponse<T>> {
  const method = opts.method ?? (opts.body ? "POST" : "GET");
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  return rawFetch<T>(opts.path, init, opts.query);
}

export { loadCredentials as _loadCredentials, persistTokens as _persistTokens };