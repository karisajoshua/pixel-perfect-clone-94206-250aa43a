import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const paths = Object.freeze({
  "preview-a": "/api/v7/IntermediaryIntegration/PreviewTypeACertificate",
  "preview-b": "/api/v7/IntermediaryIntegration/PreviewTypeBCertificate",
  "preview-c": "/api/v7/IntermediaryIntegration/PreviewTypeCCertificate",
  "preview-d": "/api/v7/IntermediaryIntegration/PreviewTypeDCertificate",
  "validate-a": "/api/v7/IntermediaryIntegration/ValidateTypeACertificate",
  "validate-b": "/api/v7/IntermediaryIntegration/ValidateTypeBCertificate",
  "validate-c": "/api/v7/IntermediaryIntegration/ValidateTypeCCertificate",
  "validate-d": "/api/v7/IntermediaryIntegration/ValidateTypeDCertificate",
  "issue-a": "/api/v7/IntermediaryIntegration/IssuanceTypeACertificate",
  "issue-b": "/api/v7/IntermediaryIntegration/IssuanceTypeBCertificate",
  "issue-c": "/api/v7/IntermediaryIntegration/IssuanceTypeCCertificate",
  "issue-d": "/api/v7/IntermediaryIntegration/IssuanceTypeDCertificate",
  stock: "/api/v6/IntermediaryIntegration/MemberCompanyStock",
  confirm: "/api/v6/Integration/ConfirmCertificateIssuance",
});

const requiredNames = [
  "DMVIC_UAT_BASE_URL", "DMVIC_UAT_USERNAME", "DMVIC_UAT_PASSWORD",
  "DMVIC_UAT_CLIENT_ID", "DMVIC_UAT_CLIENT_CERT",
  "DMVIC_UAT_CLIENT_CERT_PASSWORD", "DMVIC_GATEWAY_SHARED_SECRET",
];

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server secret: ${name}`);
  return value;
}

function config() {
  const pfx = Buffer.from(env("DMVIC_UAT_CLIENT_CERT").replace(/\s+/g, ""), "base64");
  if (!pfx.length) throw new Error("DMVIC client certificate is empty");
  return {
    baseUrl: env("DMVIC_UAT_BASE_URL").replace(/\/$/, ""),
    username: env("DMVIC_UAT_USERNAME"),
    password: env("DMVIC_UAT_PASSWORD"),
    clientId: env("DMVIC_UAT_CLIENT_ID"),
    pfx,
    passphrase: env("DMVIC_UAT_CLIENT_CERT_PASSWORD"),
    gatewaySecret: env("DMVIC_GATEWAY_SHARED_SECRET"),
  };
}

function timingSafeEqual(a, b) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function postJson(cfg, path, body, headers = {}) {
  const payload = JSON.stringify(body ?? {});
  const url = new URL(path, cfg.baseUrl + "/");
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "POST", pfx: cfg.pfx, passphrase: cfg.passphrase,
      rejectUnauthorized: true,
      headers: { "content-type": "application/json", accept: "application/json",
        "content-length": String(Buffer.byteLength(payload)), ...headers },
    }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(Buffer.from(c)));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let data = null;
        try { data = text ? JSON.parse(text) : {}; }
        catch { return reject(new Error(`DMVIC returned non-JSON HTTP ${res.statusCode ?? 0}`)); }
        resolve({ status: res.statusCode ?? 0, data });
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error("DMVIC request timed out")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

let cached;
function expiry(value) {
  const n = value ? Date.parse(value) : NaN;
  return Number.isFinite(n) ? n : Date.now() + 10 * 60_000;
}

async function login(cfg, force = false) {
  if (!force && cached && cached.expiresAt - Date.now() > 60000) return cached.token;
  const r = await postJson(cfg, "/api/v1/Account/Login",
    { Username: cfg.username, Password: cfg.password, ClientID: cfg.clientId },
    { ClientID: cfg.clientId });
  const token = r.data?.token ?? r.data?.Token;
  if (r.status < 200 || r.status >= 300 || !token) {
    const code = r.data?.code ?? "unknown";
    throw new Error(`DMVIC login failed (HTTP ${r.status}, code ${String(code)})`);
  }
  cached = { token: String(token), expiresAt: expiry(r.data?.expires) };
  return cached.token;
}

async function authenticated(cfg, path, payload) {
  let token = await login(cfg);
  let r = await postJson(cfg, path, payload, { Authorization: `Bearer ${token}`, ClientID: cfg.clientId });
  if (r.status === 401 || r.status === 403) {
    token = await login(cfg, true);
    r = await postJson(cfg, path, payload, { Authorization: `Bearer ${token}`, ClientID: cfg.clientId });
  }
  return r;
}

function alerts(raw) {
  const out = [];
  for (const e of Array.isArray(raw?.Error) ? raw.Error : [])
    out.push({ code: String(e?.errorCode ?? "UNKNOWN"), message: String(e?.errorText ?? "") });
  for (const e of Array.isArray(raw?.Errors) ? raw.Errors : [])
    out.push({ code: String(e?.code ?? "UNKNOWN"), message: String(e?.message ?? "") });
  return out;
}

function normalized(status, raw) {
  const errors = alerts(raw);
  return {
    success: status >= 200 && status < 300 && raw?.success !== false && errors.length === 0,
    status, errors,
    apiRequestNumber: raw?.APIRequestNumber ?? null,
    dmvicRefNo: raw?.DMVICRefNo ?? null,
    issuanceRequestId: raw?.Issuance?.RequestID ?? null,
    requiresManualReview: errors.some(e => e.code === "ER007"),
    blacklisted: errors.some(e => e.code === "ER0015"),
    data: raw,
  };
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(data),
    "cache-control": "no-store" });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      const missing = requiredNames.filter(n => !process.env[n]?.trim());
      return json(res, missing.length ? 503 : 200, { ok: missing.length === 0, environment: "UAT",
        configured: missing.length === 0, missing: missing.length });
    }

    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const cfg = config();
    const supplied = String(req.headers["x-zest-gateway-key"] ?? "");
    if (!supplied || !timingSafeEqual(supplied, cfg.gatewaySecret))
      return json(res, 401, { error: "Unauthorized" });

    if (req.url === "/dmvic/login-test") {
      await login(cfg, true);
      return json(res, 200, { success: true, environment: "UAT", mtls: true, authenticated: true });
    }

    const match = req.url?.match(/^\/dmvic\/([a-z-]+)$/);
    const op = match?.[1];
    const path = op ? paths[op] : undefined;
    if (!path) return json(res, 404, { error: "Unknown operation" });
    const body = await readBody(req);
    const r = await authenticated(cfg, path, body?.payload ?? {});
    return json(res, r.status >= 200 && r.status < 300 ? 200 : 502, normalized(r.status, r.data));
  } catch (e) {
    const message = e instanceof SyntaxError ? "Invalid JSON" :
      e instanceof Error ? e.message : "Gateway failure";
    console.error("[DMVIC gateway]", message);
    return json(res, e instanceof SyntaxError ? 400 : 502, { success: false, error: message });
  }
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, "0.0.0.0", () => {
  console.log(`DMVIC gateway listening on port ${port}`);
});
