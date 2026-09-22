// Client-safe DMVIC error/alert normalisation.
//
// DMVIC docs use two different envelope shapes:
//   1. { Error:  [{ errorCode, errorText }] }
//   2. { Errors: [{ code, message }], Issuance: { RequestID, Message } }
// Both are normalised into a single list of alerts. Every alert is preserved
// (DMVIC can return several ER007 entries for one request) — we never collapse
// or de-duplicate them.

export type DmvicAlertCode =
  | "ER001"
  | "ER002"
  | "ER003"
  | "ER004"
  | "ER005"
  | "ER006"
  | "ER007"
  | "ER0015";

export const DMVIC_ALERT_CODES: readonly DmvicAlertCode[] = [
  "ER001",
  "ER002",
  "ER003",
  "ER004",
  "ER005",
  "ER006",
  "ER007",
  "ER0015",
] as const;

/** Human descriptions. ER005 is a business-rule outcome (not a transport
 *  failure); ER0015 flags a blacklisted / reported-stolen vehicle. */
export const DMVIC_ALERT_MEANING: Record<DmvicAlertCode, string> = {
  ER001: "Input JSON format is incorrect.",
  ER002: "Unknown DMVIC error.",
  ER003: "Mandatory field is missing.",
  ER004: "Input is not valid.",
  ER005: "Double insurance: an active policy already exists.",
  ER006: "Insufficient certificate inventory.",
  ER007: "Policy alert raised — manual review required before confirmation.",
  ER0015: "Vehicle is blacklisted or reported stolen.",
};

export type DmvicAlert = {
  /** Recognised DMVIC code when it matches a known one, otherwise null. */
  code: DmvicAlertCode | null;
  /** Raw code string exactly as DMVIC sent it. */
  rawCode: string;
  message: string;
  /** Description for recognised codes. */
  meaning: string | null;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DmvicNormalizedResult<T extends JsonValue = JsonValue> = {
  ok: boolean;
  /** HTTP status of the DMVIC response (0 for transport failures). */
  status: number;
  /** Raw DMVIC payload (already PII-bearing — never log this). */
  data: T | null;
  /** Every alert DMVIC returned, in order, nothing dropped. */
  alerts: DmvicAlert[];
  /** Present when DMVIC returned Issuance.RequestID (e.g. ER007 policy alerts).
   *  Kept for a later, explicit confirmation/review workflow — we never call
   *  ConfirmCertificateIssuance automatically. */
  issuanceRequestId: string | null;
  issuanceMessage: string | null;
  /** True when at least one ER007 alert is present. */
  requiresManualReview: boolean;
  /** True when at least one ER0015 alert is present. */
  blacklisted: boolean;
  /** Short, non-PII summary safe to surface to staff. */
  error: string | null;
};

function normalizeCode(raw: unknown): { code: DmvicAlertCode | null; rawCode: string } {
  const rawCode = raw == null ? "" : String(raw).trim();
  const upper = rawCode.toUpperCase();
  const match = DMVIC_ALERT_CODES.find((c) => c === upper);
  return { code: match ?? null, rawCode };
}

function pushAlert(out: DmvicAlert[], rawCode: unknown, message: unknown) {
  const { code, rawCode: rc } = normalizeCode(rawCode);
  const text = message == null ? "" : String(message);
  if (!rc && !text) return;
  out.push({
    code,
    rawCode: rc,
    message: text || (code ? DMVIC_ALERT_MEANING[code] : ""),
    meaning: code ? DMVIC_ALERT_MEANING[code] : null,
  });
}

/** Extract every alert from either documented envelope shape. */
export function extractAlerts(payload: unknown): DmvicAlert[] {
  const alerts: DmvicAlert[] = [];
  if (!payload || typeof payload !== "object") return alerts;
  const p = payload as Record<string, any>;

  // Shape 1: Error: [{ errorCode, errorText }]
  const shape1 = p["Error"] ?? p["error"];
  if (Array.isArray(shape1)) {
    for (const e of shape1) {
      if (e && typeof e === "object") {
        pushAlert(alerts, e.errorCode ?? e.ErrorCode ?? e.code ?? e.Code, e.errorText ?? e.ErrorText ?? e.message ?? e.Message);
      } else {
        pushAlert(alerts, "", e);
      }
    }
  }

  // Shape 2: Errors: [{ code, message }]
  const shape2 = p["Errors"] ?? p["errors"];
  if (Array.isArray(shape2)) {
    for (const e of shape2) {
      if (e && typeof e === "object") {
        pushAlert(alerts, e.code ?? e.Code ?? e.errorCode ?? e.ErrorCode, e.message ?? e.Message ?? e.errorText ?? e.ErrorText);
      } else {
        pushAlert(alerts, "", e);
      }
    }
  }

  // Some endpoints put a single alert on the Issuance node.
  const issuance = p["Issuance"] ?? p["issuance"];
  if (issuance && typeof issuance === "object") {
    const code = (issuance as any).Code ?? (issuance as any).code ?? (issuance as any).ErrorCode;
    if (code) pushAlert(alerts, code, (issuance as any).Message ?? (issuance as any).message);
  }

  return alerts;
}

export function readIssuance(payload: unknown): { requestId: string | null; message: string | null } {
  if (!payload || typeof payload !== "object") return { requestId: null, message: null };
  const p = payload as any;
  const node = p.Issuance ?? p.issuance ?? p.callbackObj ?? p.CallbackObj;
  if (!node || typeof node !== "object") return { requestId: null, message: null };
  const requestId = node.RequestID ?? node.RequestId ?? node.requestID ?? node.requestId ?? node.IssuanceRequestID ?? node.issuanceRequestID ?? null;
  const message = node.Message ?? node.message ?? node.IssuanceMessage ?? node.issuanceMessage ?? null;
  return {
    requestId: requestId == null ? null : String(requestId),
    message: message == null ? null : String(message),
  };
}

/** Build the normalised result for any DMVIC HTTP response payload. */
export function normalizeDmvicPayload<T extends JsonValue = JsonValue>(
  status: number,
  payload: unknown,
  httpOk: boolean,
): DmvicNormalizedResult<T> {
  const alerts = extractAlerts(payload);
  const { requestId, message } = readIssuance(payload);
  const requiresManualReview = alerts.some((a) => a.code === "ER007");
  const blacklisted = alerts.some((a) => a.code === "ER0015");

  // DMVIC sets `success: false` on some 200 responses.
  const successFlag =
    payload && typeof payload === "object"
      ? ((payload as any).success ?? (payload as any).Success)
      : undefined;

  const ok = httpOk && successFlag !== false && alerts.length === 0;

  const error = alerts.length
    ? alerts.map((a) => (a.rawCode ? `${a.rawCode}: ${a.message}` : a.message)).join(" | ")
    : httpOk
      ? null
      : `DMVIC request failed (HTTP ${status}).`;

  return {
    ok,
    status,
    data: (payload as T) ?? null,
    alerts,
    issuanceRequestId: requestId,
    issuanceMessage: message,
    requiresManualReview,
    blacklisted,
    error,
  };
}
