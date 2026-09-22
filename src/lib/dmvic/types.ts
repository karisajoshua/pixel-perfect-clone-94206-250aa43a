// Client-safe DMVIC types shared between the server layer and future UI.

export type DmvicCertificateType = "A" | "B" | "C" | "D";

/**
 * DMVIC certificate request fields vary by certificate type (A/B/C/D) and are
 * still being verified against UAT, so the payload is kept as an open record of
 * primitive values. Each server function validates that shape and forwards it
 * verbatim to DMVIC.
 */
export type DmvicCertificatePayload = Record<string, string | number | boolean | null>;

export type DmvicStockRequest = {
  MemberCompanyId: string | number;
};

/** POST /api/v6/Integration/ConfirmCertificateIssuance */
export type DmvicConfirmIssuanceRequest = {
  IssuanceRequestID: string;
  IsApproved: boolean;
  IsLogBookVerified: boolean;
  IsVehicleInspected: boolean;
  AdditionalComments: string;
  UserName: string;
};

export const DMVIC_PATHS = {
  login: "/api/v1/Account/Login",
  preview: {
    A: "/api/v7/IntermediaryIntegration/PreviewTypeACertificate",
    B: "/api/v7/IntermediaryIntegration/PreviewTypeBCertificate",
    C: "/api/v7/IntermediaryIntegration/PreviewTypeCCertificate",
    D: "/api/v7/IntermediaryIntegration/PreviewTypeDCertificate",
  },
  validate: {
    A: "/api/v7/IntermediaryIntegration/ValidateTypeACertificate",
    B: "/api/v7/IntermediaryIntegration/ValidateTypeBCertificate",
    C: "/api/v7/IntermediaryIntegration/ValidateTypeCCertificate",
    D: "/api/v7/IntermediaryIntegration/ValidateTypeDCertificate",
  },
  issue: {
    A: "/api/v7/IntermediaryIntegration/IssuanceTypeACertificate",
    B: "/api/v7/IntermediaryIntegration/IssuanceTypeBCertificate",
    C: "/api/v7/IntermediaryIntegration/IssuanceTypeCCertificate",
    D: "/api/v7/IntermediaryIntegration/IssuanceTypeDCertificate",
  },
  stock: "/api/v6/IntermediaryIntegration/MemberCompanyStock",
  // NOTE: the formal confirmation endpoint is v6. Some DMVIC policy-alert
  // examples show v5; v6 is used here and MUST be verified against UAT before
  // this is wired to real certificate issuance.
  confirmIssuance: "/api/v6/Integration/ConfirmCertificateIssuance",
} as const;
