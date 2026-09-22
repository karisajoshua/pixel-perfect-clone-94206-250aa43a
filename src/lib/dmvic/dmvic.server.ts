/**
 * DMVIC Motor UAT server-only integration.
 *
 * Secrets and PKCS#12 material must stay server-side. Never log request
 * authorization, passwords, ClientID, PFX bytes/passphrases or full PII payloads.
 */
import https from "node:https";
import { dmvicCertificateSchemas } from "./dmvic.schemas";

export type DmvicCertificateType = "A" | "B" | "C" | "D";

export type DmvicErrorItem = {
  code: string;
  message: string;
};

export type DmvicResult<T = unknown> = {
  success: boolean;
  data?: T;
  errors: DmvicErrorItem[];
  apiRequestNumber?: string;
  dmvicRefNo?: string | null;
  issuanceRequestId?: string;
};

type LoginResponse = {
  token?: string;
  expires?: string;
  ApimSubscriptionKey?: string;
  code?: number;
  [key: string]: unknown;
};

type CachedAuth = {
  token: string;
  expiresAt: number;
};

type DmvicConfig = {
  baseUrl: string;
  username: string;
  password: string;
  clientId: string;
  pfx: Buffer;
  pfxPassphrase: string;
};

let cachedAuth: CachedAuth | undefined;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required DMVIC server secret: ${name}`);
  return value;
}

function certificateBuffer(value: string): Buffer {
  // Deployment secrets should normally contain base64 PKCS#12. This also
  // tolerates accidental whitespace/newlines introduced by secret managers.
  const normalized = value.replace(/\s+/g, "");
  const decoded = Buffer.from(normalized, "base64");
  if (!decoded.length) throw new Error("DMVIC client certificate is empty");
  return decoded;
}

export function getDmvicConfig(): DmvicConfig {
  return {
    baseUrl: required("DMVIC_UAT_BASE_URL").replace(/\/$/, ""),
    username: required("DMVIC_UAT_USERNAME"),
    password: required("DMVIC_UAT_PASSWORD"),
    clientId: required("DMVIC_UAT_CLIENT_ID"),
    pfx: certificateBuffer(required("DMVIC_UAT_CLIENT_CERT")),
    pfxPassphrase: required("DMVIC_UAT_CLIENT_CERT_PASSWORD"),
  };
}

function postJson<T>(
  config: DmvicConfig,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const url = new URL(path, config.baseUrl + "/");
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        pfx: config.pfx,
        passphrase: config.pfxPassphrase,
        rejectUnauthorized: true,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "content-length": Buffer.byteLength(payload).toString(),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown;
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            return reject(
              new Error(`DMVIC returned a non-JSON response (HTTP ${res.statusCode ?? 0})`),
            );
          }
          if ((res.statusCode ?? 500) >= 400) {
            return reject(
              new Error(`DMVIC request failed with HTTP ${res.statusCode}`),
            );
          }
          resolve(parsed as T);
        });
      },
    );

    req.setTimeout(30_000, () => req.destroy(new Error("DMVIC request timed out")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function parseExpiry(value?: string): number {
  if (!value) return Date.now() + 10 * 60_000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now() + 10 * 60_000;
}

export async function dmvicLogin(force = false): Promise<string> {
  if (!force && cachedAuth && cachedAuth.expiresAt - Date.now() > 60_000) {
    return cachedAuth.token;
  }

  const config = getDmvicConfig();
  const response = await postJson<LoginResponse>(
    config,
    "/api/v1/Account/Login",
    {
      Username: config.username,
      Password: config.password,
      ClientID: config.clientId,
    },
    { ClientID: config.clientId },
  );

  if (!response.token) {
    throw new Error(`DMVIC login failed (code ${String(response.code ?? "unknown")})`);
  }

  cachedAuth = {
    token: response.token,
    expiresAt: parseExpiry(response.expires),
  };
  return response.token;
}

async function authenticatedPost<T>(path: string, body: unknown): Promise<T> {
  const config = getDmvicConfig();
  const token = await dmvicLogin();
  return postJson<T>(config, path, body, {
    Authorization: `Bearer ${token}`,
    ClientID: config.clientId,
  });
}

function normalize<T = unknown>(raw: any): DmvicResult<T> {
  const standard = Array.isArray(raw?.Error)
    ? raw.Error.map((e: any) => ({
        code: String(e?.errorCode ?? "UNKNOWN"),
        message: String(e?.errorText ?? "Unknown DMVIC error"),
      }))
    : [];
  const alerts = Array.isArray(raw?.Errors)
    ? raw.Errors.map((e: any) => ({
        code: String(e?.code ?? "UNKNOWN"),
        message: String(e?.message ?? "Unknown DMVIC error"),
      }))
    : [];

  return {
    success: raw?.success === true,
    data: raw as T,
    errors: [...standard, ...alerts],
    apiRequestNumber: raw?.APIRequestNumber,
    dmvicRefNo: raw?.DMVICRefNo,
    issuanceRequestId: raw?.Issuance?.RequestID,
  };
}

const previewPath: Record<DmvicCertificateType, string> = {
  A: "/api/v7/IntermediaryIntegration/PreviewTypeACertificate",
  B: "/api/v7/IntermediaryIntegration/PreviewTypeBCertificate",
  C: "/api/v7/IntermediaryIntegration/PreviewTypeCCertificate",
  D: "/api/v7/IntermediaryIntegration/PreviewTypeDCertificate",
};

const validatePath: Record<DmvicCertificateType, string> = {
  A: "/api/v7/IntermediaryIntegration/ValidateTypeACertificate",
  B: "/api/v7/IntermediaryIntegration/ValidateTypeBCertificate",
  C: "/api/v7/IntermediaryIntegration/ValidateTypeCCertificate",
  D: "/api/v7/IntermediaryIntegration/ValidateTypeDCertificate",
};

const issuePath: Record<DmvicCertificateType, string> = {
  A: "/api/v7/IntermediaryIntegration/IssuanceTypeACertificate",
  B: "/api/v7/IntermediaryIntegration/IssuanceTypeBCertificate",
  C: "/api/v7/IntermediaryIntegration/IssuanceTypeCCertificate",
  D: "/api/v7/IntermediaryIntegration/IssuanceTypeDCertificate",
};

export async function previewCertificate(
  type: DmvicCertificateType,
  payload: unknown,
): Promise<DmvicResult> {
  const validated = dmvicCertificateSchemas[type].parse(payload);
  return normalize(await authenticatedPost(previewPath[type], validated));
}

export async function validateCertificate(
  type: DmvicCertificateType,
  payload: unknown,
): Promise<DmvicResult> {
  const validated = dmvicCertificateSchemas[type].parse(payload);
  return normalize(await authenticatedPost(validatePath[type], validated));
}

export async function issueCertificate(
  type: DmvicCertificateType,
  payload: unknown,
): Promise<DmvicResult> {
  const validated = dmvicCertificateSchemas[type].parse(payload);
  return normalize(await authenticatedPost(issuePath[type], validated));
}

export async function getMemberCompanyStock(
  memberCompanyId: number,
): Promise<DmvicResult> {
  return normalize(
    await authenticatedPost("/api/v6/IntermediaryIntegration/MemberCompanyStock", {
      MemberCompanyId: memberCompanyId,
    }),
  );
}

export type ConfirmIssuanceInput = {
  IssuanceRequestID: string;
  IsApproved: boolean;
  IsLogBookVerified: boolean;
  IsVehicleInspected: boolean;
  AdditionalComments: string;
  UserName: string;
};

export async function confirmCertificateIssuance(
  input: ConfirmIssuanceInput,
): Promise<DmvicResult> {
  // Use the formally documented v6 endpoint. Earlier policy-alert messages
  // reference v5; UAT must confirm v6 before this is enabled in user flows.
  return normalize(
    await authenticatedPost("/api/v6/Integration/ConfirmCertificateIssuance", input),
  );
}
