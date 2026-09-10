/**
 * WhatsApp provider abstraction + Meta Cloud API connector (server-only).
 *
 * Nothing outside this file knows about Meta's HTTP shape. Credentials are read
 * from the secure secret store (environment) at call time and are never stored
 * in ordinary database columns, never logged and never sent to the browser.
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = "https://graph.facebook.com";

export interface ProviderChannel {
  id: string;
  tenant_id: string;
  provider: string;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  credentials_ref: string | null;
}

export interface ProviderSendPayload {
  to: string; // E.164 without '+', added here
  kind: "text" | "template" | "media";
  body?: string;
  template?: { name: string; language: string; components?: unknown[] };
  media?: { type: "image" | "document" | "audio" | "video"; link: string; caption?: string; filename?: string };
}

export interface ProviderSendResult {
  ok: boolean;
  provider_message_id?: string;
  error?: string;
  error_code?: string;
  retryable?: boolean;
  raw?: unknown;
}

export interface WhatsAppProvider {
  readonly name: string;
  send(channel: ProviderChannel, payload: ProviderSendPayload): Promise<ProviderSendResult>;
  health(channel: ProviderChannel): Promise<{ ok: boolean; detail?: string; display_name?: string; verified_name?: string }>;
}

/** Reads the access token for a channel from the secure secret store. */
export function resolveAccessToken(channel: ProviderChannel): string | null {
  const ref = (channel.credentials_ref ?? "").trim();
  const env = process.env as Record<string, string | undefined>;
  const token = (ref ? env[ref] : undefined) ?? env["WHATSAPP_ACCESS_TOKEN"];
  return token && token.trim() ? token.trim() : null;
}

function e164Digits(to: string): string {
  return to.replace(/[^\d]/g, "");
}

function classifyHttp(status: number): boolean {
  // Retryable: throttling, timeouts and provider-side failures.
  return status === 408 || status === 429 || status >= 500;
}

export const metaCloudProvider: WhatsAppProvider = {
  name: "meta_cloud",

  async send(channel, payload) {
    const token = resolveAccessToken(channel);
    if (!token) return { ok: false, error: "WhatsApp access token is not configured", retryable: false };
    if (!channel.phone_number_id) return { ok: false, error: "WhatsApp phone number ID is not configured", retryable: false };

    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: e164Digits(payload.to),
    };

    if (payload.kind === "text") {
      body.type = "text";
      body.text = { preview_url: false, body: payload.body ?? "" };
    } else if (payload.kind === "template") {
      body.type = "template";
      body.template = {
        name: payload.template?.name,
        language: { code: payload.template?.language ?? "en" },
        ...(payload.template?.components?.length ? { components: payload.template.components } : {}),
      };
    } else {
      const m = payload.media!;
      body.type = m.type;
      (body as any)[m.type] = {
        link: m.link,
        ...(m.caption ? { caption: m.caption } : {}),
        ...(m.filename && m.type === "document" ? { filename: m.filename } : {}),
      };
    }

    try {
      const res = await fetch(`${GRAPH_BASE}/${GRAPH_VERSION}/${channel.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = json?.error ?? {};
        return {
          ok: false,
          error: err.message ?? `Provider responded ${res.status}`,
          error_code: err.code != null ? String(err.code) : String(res.status),
          retryable: classifyHttp(res.status),
          raw: json,
        };
      }
      return { ok: true, provider_message_id: json?.messages?.[0]?.id ?? null, raw: json };
    } catch (e: any) {
      return { ok: false, error: `Provider request failed: ${e?.message ?? String(e)}`, retryable: true };
    }
  },

  async health(channel) {
    const token = resolveAccessToken(channel);
    if (!token) return { ok: false, detail: "Access token secret is missing" };
    if (!channel.phone_number_id) return { ok: false, detail: "Phone number ID is missing" };
    try {
      const res = await fetch(
        `${GRAPH_BASE}/${GRAPH_VERSION}/${channel.phone_number_id}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, detail: json?.error?.message ?? `Provider responded ${res.status}` };
      return {
        ok: true,
        display_name: json?.verified_name ?? undefined,
        verified_name: json?.verified_name ?? undefined,
        detail: json?.display_phone_number ?? undefined,
      };
    } catch (e: any) {
      return { ok: false, detail: `Provider unreachable: ${e?.message ?? String(e)}` };
    }
  },
};

export function getProvider(name: string | null | undefined): WhatsAppProvider {
  switch (name ?? "meta_cloud") {
    case "meta_cloud":
      return metaCloudProvider;
    default:
      throw new Error(`Unsupported WhatsApp provider '${name}'`);
  }
}

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body. */
export async function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header || !appSecret) return false;
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}
