export type DmvicCertificateOrderStatus =
  | "awaiting_validation"
  | "validated"
  | "awaiting_payment"
  | "paid"
  | "issuing"
  | "issued"
  | "manual_review"
  | "failed"
  | "refund_pending"
  | "refunded";

export type DmvicPaymentStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "refund_pending"
  | "refunded";

export type DmvicSettlementStatus = "unsettled" | "pending" | "settled" | "disputed";

export const DMVIC_ORDER_FLOW: Record<DmvicCertificateOrderStatus, readonly DmvicCertificateOrderStatus[]> = {
  awaiting_validation: ["validated", "manual_review", "failed"],
  validated: ["awaiting_payment"],
  awaiting_payment: ["paid", "failed"],
  paid: ["issuing", "refund_pending"],
  issuing: ["issued", "manual_review", "failed"],
  issued: [],
  manual_review: ["validated", "issuing", "refund_pending", "failed"],
  failed: ["awaiting_validation", "refund_pending"],
  refund_pending: ["refunded"],
  refunded: [],
};

export function canTransitionDmvicOrder(
  from: DmvicCertificateOrderStatus,
  to: DmvicCertificateOrderStatus,
): boolean {
  return DMVIC_ORDER_FLOW[from].includes(to);
}

/**
 * Customer payment and DMVIC settlement are deliberately separate ledgers.
 * A confirmed customer payment permits issuance; it never means DMVIC has been paid.
 */
export function canIssueAfterPayment(input: {
  orderStatus: DmvicCertificateOrderStatus;
  paymentStatus: DmvicPaymentStatus;
  validationPassed: boolean;
  stockAvailable: boolean;
}): boolean {
  return (
    input.orderStatus === "paid" &&
    input.paymentStatus === "confirmed" &&
    input.validationPassed &&
    input.stockAvailable
  );
}

export function grossCertificateMargin(sellingPrice: number, dmvicCost: number | null): number | null {
  if (dmvicCost == null) return null;
  return sellingPrice - dmvicCost;
}
