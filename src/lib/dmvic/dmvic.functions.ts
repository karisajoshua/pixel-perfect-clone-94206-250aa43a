// Typed server functions for the DMVIC Motor UAT integration.
//
// Every function is authenticated (agency staff only) and runs server-side;
// the DMVIC transport layer (mTLS + credentials) is loaded *inside* handlers so
// nothing server-only leaks into the client bundle.
//
// This is the foundation layer only — it is deliberately NOT wired to end-user
// certificate issuance yet.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dmvicCertificateRequestSchema } from "./schemas";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";
import { DMVIC_PATHS, type DmvicCertificateType } from "./types";
import type { DmvicNormalizedResult, JsonValue } from "./errors";

const certRequestSchema = dmvicCertificateRequestSchema;

/** Shape returned to callers: normalised, alert-preserving, no credentials. */
export type DmvicResult<T extends JsonValue = JsonValue> = DmvicNormalizedResult<T> & {
  /** Set when DMVIC could not be reached or is not configured on this server. */
  transportError?: string;
};

async function call(path: string, body: unknown): Promise<DmvicResult> {
  const { dmvicPost } = await import("./dmvic-client.server");
  try {
    return await dmvicPost(path, body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown DMVIC failure";
    // Message only — never the request body (PII) or any credential.
    console.error(`[DMVIC] ${path} failed: ${message}`);
    return {
      ok: false,
      status: 0,
      data: null,
      alerts: [],
      issuanceRequestId: null,
      issuanceMessage: null,
      requiresManualReview: false,
      blacklisted: false,
      error: message,
      transportError: message,
    };
  }
}


const typeAPreviewFromZestSchema = z.object({
  memberCompanyId: z.union([z.string().min(1), z.number().int().positive()]),
  certificateTypeCode: z.union([z.literal(1), z.literal(8)]),
  coverCode: z.union([z.literal(100), z.literal(200), z.literal(300)]),
  policyholder: z.string().min(1),
  policyNumber: z.string().min(1),
  commencementDate: z.string(),
  expiryDate: z.string(),
  registrationNumber: z.string().optional(),
  chassisNumber: z.string().min(4).max(20),
  phoneNumber: z.string().min(9).max(15),
  bodyType: z.string().min(1),
  licensedToCarry: z.number().int().positive(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  engineNumber: z.string().optional(),
  email: z.string().email(),
  sumInsured: z.number().nonnegative().optional(),
  insuredPin: z.string().min(1).max(11),
  yearOfManufacture: z.number().int().min(1900).max(2200).optional(),
  hudumaNumber: z.string().optional(),
});

/**
 * First application-level Zest → DMVIC operation.
 * Maps canonical Zest motor/policy data and performs PREVIEW only.
 * It deliberately cannot issue a certificate or consume certificate stock.
 */
export const dmvicPreviewTypeAFromZest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(typeAPreviewFromZestSchema)
  .handler(async ({ data }) => {
    const { mapZestToDmvicTypeA } = await import("./zest-mapping");
    const payload = mapZestToDmvicTypeA(data);
    return call(DMVIC_PATHS.preview.A, payload);
  });

/** Preview a Type A/B/C/D certificate (no stock is consumed). */
export const dmvicPreviewCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(certRequestSchema)
  .handler(async ({ data }) =>
    call(DMVIC_PATHS.preview[data.certificateType as DmvicCertificateType], data.payload),
  );

/** Validate a Type A/B/C/D certificate request before issuance. */
export const dmvicValidateCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(certRequestSchema)
  .handler(async ({ data }) =>
    call(DMVIC_PATHS.validate[data.certificateType as DmvicCertificateType], data.payload),
  );

/**
 * Issue a Type A/B/C/D certificate.
 *
 * IMPORTANT: when DMVIC returns ER007 (policy alert) we do NOT call
 * ConfirmCertificateIssuance automatically. The IssuanceRequestID is returned
 * to the caller so a human can approve it later through an explicit review
 * workflow.
 */
export const dmvicIssueCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(certRequestSchema)
  .handler(async ({ data }) => {
    const result = await call(
      DMVIC_PATHS.issue[data.certificateType as DmvicCertificateType],
      data.payload,
    );
    // No auto-confirmation on ER007 — surfaced for manual review instead.
    return result;
  });

/** POST /api/v6/IntermediaryIntegration/MemberCompanyStock */
export const dmvicMemberCompanyStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ MemberCompanyId: z.union([z.string(), z.number()]) }))
  .handler(async ({ data }) => call(DMVIC_PATHS.stock, { MemberCompanyId: data.MemberCompanyId }));

/**
 * POST /api/v6/Integration/ConfirmCertificateIssuance — explicit, human-driven
 * confirmation of an issuance that raised a policy alert (e.g. ER007).
 *
 * The formal endpoint is v6; some DMVIC policy-alert examples reference v5.
 * This MUST be verified against UAT before being used in a live flow.
 */
export const dmvicConfirmCertificateIssuance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      IssuanceRequestID: z.string().min(1),
      IsApproved: z.boolean(),
      IsLogBookVerified: z.boolean(),
      IsVehicleInspected: z.boolean(),
      AdditionalComments: z.string(),
      UserName: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => call(DMVIC_PATHS.confirmIssuance, data));

/** Configuration probe for admin screens — reports readiness, never values. */
export const dmvicConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { isDmvicConfigured } = await import("./dmvic-client.server");
    return { configured: isDmvicConfigured(), environment: "UAT" as const };
  });
