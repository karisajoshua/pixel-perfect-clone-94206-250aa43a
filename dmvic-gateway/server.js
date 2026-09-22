// DMVIC mTLS gateway.
//
// Architecture: Zest app (Cloudflare Worker) -> this gateway (Node on Render) -> DMVIC UAT.
//
// The Worker runtime has no Node TLS stack, so the PKCS#12 client certificate
// lives ONLY here, in server environment variables. Nothing about DMVIC
// (username, password, ClientID, PFX bytes, passphrase, bearer token) is ever
// returned to the caller or written to logs.
//
// Zero npm dependencies on purpose: a dependency-free service cannot fail a
// Render build on install/resolution.

import http from "node:http";
import https from "node:https";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 10000);

const REQUIRED = [
  "DMVIC_UAT_BASE_URL",
  "DMVIC_UAT_USERNAME",
  "DMVIC_UAT_PASSWORD",
  "DMVIC_UAT_CLIENT_ID",
  "DMVIC_UAT_CLIENT_CERT",
  "DMVIC_UAT_CLIENT_CERT_PASSWORD",
  "DMVIC_GATEWAY_TOKEN",
];

function missingEnv() {
  return REQUIRED.filter((k) => !process.env[k]);
}

function config() {
  return {
    baseUrl: String(process.env.DMVIC_UAT_BASE_URL).replace(/\/$/, ""),
    username: String(process.env.DMVIC_UAT_USERNAME),
    password: String(process.env.DMVIC_UAT_PASSWORD),
    clientId: String(process.env.DMVIC_UAT_CLIENT_ID),
    pfx: Buffer.from(String(process.env.DMVIC_UAT_CLIENT_CERT), "base64"),
    passphrase: String(process.env.DMVIC_UAT_CLIENT_CERT_PASSWORD),
  };
}

function authorized(req) {
  const expected = process.env.DMVIC_GATEWAY_TOKEN || "";
  const header = req.headers["authorization"] || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function mtlsRequest(cfg, path, headers, body) {
  const url = new URL(cfg.baseUrl + path);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "POST",
        headers,
        pfx: cfg.pfx,
        passphrase: cfg.passphrase,
        rejectUnauthorized: true,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", (e) => reject(new Error(`DMVIC connection failed: ${e.message}`)));
    req.setTimeout(45_000, () => req.destroy(new Error("timed out after 45s")));
    if (body) req.write(body);
    req.end();
  });
}

let tokenCache = null;

async function login(cfg) {
  const body = JSON.stringify({
    Username: cfg.username,
    Password: cfg.password,
    ClientID: cfg.clientId,
  });
  const res = await mtlsRequest(
    cfg,
    "/api/v1/Account/Login",
    {
      "Content-Type": "application/json",
      Accept: "application/json",
      ClientID: cfg.clientId,
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
  );
  let payload = null;
  try {
    payload = JSON.parse(res.text);
  } catch {
    payload = null;
  }
  const token =
    payload?.token ?? payload?.Token ?? payload?.access_token ?? payload?.AccessToken ?? null;
  if (res.status < 200 || res.status >= 300 || !token) {
    throw new Error(`DMVIC login failed (HTTP ${res.status}).`);
  }
  tokenCache = { token: String(token), expiresAt: Date.now() + 20 * 60_000 };
  return tokenCache.token;
}

async function getToken(cfg, force = false) {
  if (!force && tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  tokenCache = null;
  return login(cfg);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, status, obj) {
  const text = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(text)),
    "cache-control": "no-store",
  });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");

  // Health check: readiness only, never values.
  if (req.method === "GET" && url.pathname === "/health") {
    const missing = missingEnv();
    return json(res, missing.length ? 503 : 200, {
      ok: missing.length === 0,
      configured: missing.length === 0,
      missing,
      environment: "UAT",
    });
  }

  // Temporary browser-safe UAT diagnostic. It returns only pass/fail and never
  // exposes credentials, certificate material, or the DMVIC bearer token.
  // Remove this route immediately after the UAT authentication check.
  if (req.method === "GET" && url.pathname === "/uat-auth-diagnostic") {
    const missing = missingEnv();
    if (missing.length) {
      return json(res, 503, { ok: false, authenticated: false, configured: false });
    }
    try {
      await getToken(config(), true);
      return json(res, 200, { ok: true, authenticated: true, environment: "UAT" });
    } catch (e) {
      console.error(`[DMVIC] browser diagnostic failed: ${e instanceof Error ? e.message : "unknown"}`);
      return json(res, 502, {
        ok: false,
        authenticated: false,
        environment: "UAT",
        error: e instanceof Error ? e.message : "DMVIC authentication failed",
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/auth-test") {
    if (!authorized(req)) {
      return json(res, 401, { error: "Unauthorized" });
    }
    const missing = missingEnv();
    if (missing.length) {
      return json(res, 503, { error: `Gateway not configured. Missing: ${missing.join(", ")}` });
    }
    try {
      await getToken(config(), true);
      return json(res, 200, { ok: true, authenticated: true, environment: "UAT" });
    } catch (e) {
      console.error(`[DMVIC] auth test failed: ${e instanceof Error ? e.message : "unknown"}`);
      return json(res, 502, {
        ok: false,
        authenticated: false,
        error: e instanceof Error ? e.message : "DMVIC authentication failed",
      });
    }
  }

  if (req.method !== "POST" || url.pathname !== "/dmvic") {
    return json(res, 404, { error: "Not found" });
  }
  if (!authorized(req)) {
    return json(res, 401, { error: "Unauthorized" });
  }

  const missing = missingEnv();
  if (missing.length) {
    return json(res, 503, { error: `Gateway not configured. Missing: ${missing.join(", ")}` });
  }

  let parsed;
  try {
    parsed = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: "Invalid JSON body" });
  }

  const path = typeof parsed?.path === "string" ? parsed.path : "";
  // Only DMVIC API paths may be proxied; no open relay.
  if (!/^\/api\/v[0-9]+\/[A-Za-z]+\/[A-Za-z0-9]+$/.test(path)) {
    return json(res, 400, { error: "Invalid DMVIC path" });
  }

  const cfg = config();
  const payload = JSON.stringify(parsed?.body ?? {});
  const call = async (token) =>
    mtlsRequest(
      cfg,
      path,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ClientID: cfg.clientId,
        "Content-Length": String(Buffer.byteLength(payload)),
      },
      payload,
    );

  try {
    let token = await getToken(cfg);
    let out = await call(token);
    if (out.status === 401 || out.status === 403) {
      token = await getToken(cfg, true);
      out = await call(token);
    }
    // PII-free audit line.
    console.info(`[DMVIC] POST ${path} -> ${out.status}`);
    return json(res, 200, { status: out.status, text: out.text });
  } catch (e) {
    console.error(`[DMVIC] ${path} failed: ${e instanceof Error ? e.message : "unknown"}`);
    return json(res, 502, {
      error: e instanceof Error ? e.message : "DMVIC request failed",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.info(`DMVIC mTLS gateway listening on ${PORT}`);
});
