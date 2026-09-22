/**
 * DMVIC Motor UAT server-only integration boundary.
 *
 * IMPORTANT:
 * - Never import this module into browser/client bundles.
 * - Credentials and client certificates must be supplied through server-side
 *   deployment secrets. Never commit them to Git.
 * - Exact endpoint paths/payloads are intentionally configured from the
 *   official DMVIC integration documentation rather than guessed here.
 */

export type DmvicOperation =
  | "certificate-preview"
  | "certificate-issue"
  | "certificate-cancel"
  | "insurance-status"
  | "stock-status";

export type DmvicConfig = {
  baseUrl: string;
  username?: string;
  password?: string;
  clientCertificate?: string;
  clientCertificatePassword?: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required DMVIC server secret: ${name}`);
  return value;
}

export function getDmvicConfig(): DmvicConfig {
  return {
    baseUrl: required("DMVIC_UAT_BASE_URL").replace(/\/$/, ""),
    username: process.env.DMVIC_UAT_USERNAME?.trim(),
    password: process.env.DMVIC_UAT_PASSWORD,
    clientCertificate: process.env.DMVIC_UAT_CLIENT_CERT,
    clientCertificatePassword: process.env.DMVIC_UAT_CLIENT_CERT_PASSWORD,
  };
}

const endpointEnv: Record<DmvicOperation, string> = {
  "certificate-preview": "DMVIC_UAT_CERTIFICATE_PREVIEW_PATH",
  "certificate-issue": "DMVIC_UAT_CERTIFICATE_ISSUE_PATH",
  "certificate-cancel": "DMVIC_UAT_CERTIFICATE_CANCEL_PATH",
  "insurance-status": "DMVIC_UAT_INSURANCE_STATUS_PATH",
  "stock-status": "DMVIC_UAT_STOCK_STATUS_PATH",
};

export async function dmvicRequest<TResponse = unknown>(
  operation: DmvicOperation,
  payload: unknown,
): Promise<TResponse> {
  const config = getDmvicConfig();
  const path = required(endpointEnv[operation]);
  const url = new URL(path, config.baseUrl + "/");

  // Authentication/mTLS wiring depends on the runtime and the exact DMVIC
  // UAT specification. Do not send certificate material in HTTP headers.
  // This boundary deliberately fails closed until the official transport
  // requirements are mapped from DMVIC's supplied documentation.
  throw new Error(
    `DMVIC transport is not enabled yet for ${operation} (${url.origin}). Configure the official UAT authentication/mTLS requirements first.`,
  );
}
