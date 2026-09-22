// Server-only DMVIC (UAT) transport layer.
//
// SECURITY
//  - Every credential is read from server env at call time; nothing is hard-coded.
//  - This module is *.server.ts, so it can never reach the browser bundle.
//  - The X.509 client certificate is presented as a real TLS client certificate
//    (PKCS#12 / PFX supplied to the TLS handshake), never as an HTTP header.
//  - Missing configuration fails closed: no request is attempted.
//  - Request and response bodies carry PII and are never logged. Only method,
//    path, HTTP status and DMVIC alert codes are logged.
//
// RUNTIME LIMITATION
//  The published app runs on a Cloudflare Worker (workerd). workerd does not
//  expose Node's TLS stack, so a PKCS#12 client certificate cannot be loaded at
//  runtime there — mTLS on Workers requires a platform-level mTLS certificate
//  binding. This layer therefore uses Node's `node:https` (available in local
//  dev / Node SSR) and fails closed with an explicit, actionable error anywhere
//  the Node TLS stack is unavailable. No fallback to a plain-TLS request is
//  made, because that would silently drop the client certificate.

import { Buffer } from "node:buffer";
import { normalizeDmvicPayload, type DmvicNormalizedResult, type JsonValue } from "./errors";

export type DmvicConfig = {
  baseUrl: string;
  username: string;
  password: string;
  clientId: string;
  /** Base64-encoded PKCS#12 / PFX bundle. */
  certBase64: string;
  certPassword: string;
};

export class DmvicConfigError extends Error {}
export class DmvicTransportError extends Error {}

const REQUIRED_ENV = [
  "DMVIC_UAT_BASE_URL",
  "DMVIC_UAT_USERNAME",
  "DMVIC_UAT_PASSWORD",
  "DMVIC_UAT_CLIENT_ID",
  "DMVIC_UAT_CLIENT_CERT",
  "DMVIC_UAT_CLIENT_CERT_PASSWORD",
] as const;

/** Read config per request (Workers bind env at request time). Fails closed. */
export function getDmvicConfig(): DmvicConfig {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    // Names only — never values.
    throw new DmvicConfigError(
      `DMVIC is not configured. Missing server secret(s): ${missing.join(", ")}.`,
    );
  }
  return {
    baseUrl: (process.env["DMVIC_UAT_BASE_URL"] as string).replace(/\/$/, ""),
    username: process.env["DMVIC_UAT_USERNAME"] as string,
    password: process.env["DMVIC_UAT_PASSWORD"] as string,
    clientId: process.env["DMVIC_UAT_CLIENT_ID"] as string,
    certBase64: process.env["DMVIC_UAT_CLIENT_CERT"] as string,
    certPassword: process.env["DMVIC_UAT_CLIENT_CERT_PASSWORD"] as string,
  };
}

export function isDmvicConfigured(): boolean {
  return isGatewayConfigured() || REQUIRED_ENV.every((k) => Boolean(process.env[k]));
}

// ---------------------------------------------------------------------------
// Gateway transport (preferred on Cloudflare Workers)
// ---------------------------------------------------------------------------
//
// The published app runs on workerd, which has no Node TLS stack, so the
// PKCS#12 client certificate cannot be presented from here. When a Node-hosted
// mTLS gateway is configured (see dmvic-gateway/), every DMVIC call is proxied
// through it over plain HTTPS with a shared bearer token. The certificate and
// the DMVIC credentials never leave that gateway.

export function isGatewayConfigured(): boolean {
  return Boolean(process.env["DMVIC_GATEWAY_URL"] && process.env["DMVIC_GATEWAY_TOKEN"]);
}

async function gatewayCall(path: string, body: unknown): Promise<RawResponse> {
  const base = (process.env["DMVIC_GATEWAY_URL"] as string).replace(/\/$/, "");
  const res = await fetch(`${base}/dmvic`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${process.env["DMVIC_GATEWAY_TOKEN"] as string}`,
    },
    body: JSON.stringify({ path, body: body ?? {} }),
  });
  const envelope = (await res.json().catch(() => null)) as
    | { status?: number; text?: string; error?: string }
    | null;
  if (!res.ok || !envelope || typeof envelope.status !== "number") {
    throw new DmvicTransportError(
      envelope?.error ?? `DMVIC gateway request failed (HTTP ${res.status}).`,
    );
  }
  const status = envelope.status;
  return { status, ok: status >= 200 && status < 300, text: envelope.text ?? "" };
}

type RawResponse = { status: number; ok: boolean; text: string };

/**
 * Perform one HTTPS request presenting the PKCS#12 client certificate in the
 * TLS handshake. Uses node:https; throws DmvicTransportError when the Node TLS
 * stack is not available in the current runtime.
 */
async function mtlsRequest(
  cfg: DmvicConfig,
  path: string,
  method: "GET" | "POST",
  headers: Record<string, string>,
  body?: string,
): Promise<RawResponse> {
  let https: typeof import("node:https");
  try {
    https = await import("node:https");
  } catch {
    throw new DmvicTransportError(
      "DMVIC mTLS is unavailable in this runtime: the Node TLS stack could not be loaded.",
    );
  }
  if (typeof (https as any).request !== "function") {
    throw new DmvicTransportError(
      "DMVIC mTLS is unavailable in this runtime: node:https has no working request implementation.",
    );
  }

  let pfx: Buffer;
  try {
    pfx = Buffer.from(cfg.certBase64, "base64");
    if (pfx.length === 0) throw new Error("empty");
  } catch {
    throw new DmvicConfigError(
      "DMVIC_UAT_CLIENT_CERT is not a valid base64 PKCS#12/PFX bundle.",
    );
  }

  const url = new URL(cfg.baseUrl + path);

  return await new Promise<RawResponse>((resolve, reject) => {
    let req: import("node:http").ClientRequest;
    try {
      req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method,
          headers,
          pfx,
          passphrase: cfg.certPassword,
          // Server certificate verification stays ON.
          rejectUnauthorized: true,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const status = res.statusCode ?? 0;
            resolve({
              status,
              ok: status >= 200 && status < 300,
              text: Buffer.concat(chunks).toString("utf8"),
            });
          });
        },
      );
    } catch (e) {
      reject(
        new DmvicTransportError(
          `DMVIC mTLS request could not be started in this runtime: ${
            e instanceof Error ? e.message : "unknown error"
          }`,
        ),
      );
      return;
    }
    req.on("error", (e: Error) =>
      // Message only; no request body, no credentials.
      reject(new DmvicTransportError(`DMVIC connection failed: ${e.message}`)),
    );
    req.setTimeout(45_000, () => {
      req.destroy(new Error("timed out after 45s"));
    });
    if (body) req.write(body);
    req.end();
  });
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// Login / token cache
// ---------------------------------------------------------------------------

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

/** POST /api/v1/Account/Login — Username, Password, ClientID. */
async function login(cfg: DmvicConfig): Promise<string> {
  const body = JSON.stringify({
    Username: cfg.username,
    Password: cfg.password,
    ClientID: cfg.clientId,
  });
  const res = await mtlsRequest(
    cfg,
    "/api/v1/Account/Login",
    "POST",
    {
      "Content-Type": "application/json",
      Accept: "application/json",
      ClientID: cfg.clientId,
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
  );
  const payload = parseJson(res.text) as any;
  const token =
    payload?.token ??
    payload?.Token ??
    payload?.access_token ??
    payload?.AccessToken ??
    payload?.data?.token ??
    null;
  if (!res.ok || !token) {
    const normalized = normalizeDmvicPayload(res.status, payload, res.ok);
    throw new DmvicTransportError(
      normalized.error ?? `DMVIC login failed (HTTP ${res.status}).`,
    );
  }
  // DMVIC UAT tokens are short-lived; cache conservatively for 20 minutes.
  tokenCache = { token: String(token), expiresAt: Date.now() + 20 * 60_000 };
  return tokenCache.token;
}

async function getToken(cfg: DmvicConfig, forceRefresh = false): Promise<string> {
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }
  tokenCache = null;
  return login(cfg);
}

// ---------------------------------------------------------------------------
// Authenticated call
// ---------------------------------------------------------------------------

/**
 * Authenticated DMVIC POST. Attaches `Authorization: Bearer <token>` and
 * `ClientID`, retries once on 401 with a fresh token, and returns the
 * normalised alert-preserving result.
 */
export async function dmvicPost<T extends JsonValue = JsonValue>(
  path: string,
  body: unknown,
): Promise<DmvicNormalizedResult<T>> {
  // Preferred path: the Node-hosted mTLS gateway (works on Cloudflare Workers).
  if (isGatewayConfigured()) {
    const res = await gatewayCall(path, body);
    const normalized = normalizeDmvicPayload<T>(res.status, parseJson(res.text), res.ok);
    console.info(
      `[DMVIC] gateway POST ${path} -> ${res.status}` +
        (normalized.alerts.length
          ? ` alerts=${normalized.alerts.map((a) => a.rawCode || "?").join(",")}`
          : ""),
    );
    return normalized;
  }

  const cfg = getDmvicConfig();
  const payload = JSON.stringify(body ?? {});

  const call = async (token: string) =>
    mtlsRequest(
      cfg,
      path,
      "POST",
      {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ClientID: cfg.clientId,
        "Content-Length": String(Buffer.byteLength(payload)),
      },
      payload,
    );

  let token = await getToken(cfg);
  let res = await call(token);
  if (res.status === 401 || res.status === 403) {
    token = await getToken(cfg, true);
    res = await call(token);
  }

  const parsed = parseJson(res.text);
  const normalized = normalizeDmvicPayload<T>(res.status, parsed, res.ok);
  // PII-free audit line.
  console.info(
    `[DMVIC] POST ${path} -> ${res.status}` +
      (normalized.alerts.length
        ? ` alerts=${normalized.alerts.map((a) => a.rawCode || "?").join(",")}`
        : ""),
  );
  return normalized;
}
