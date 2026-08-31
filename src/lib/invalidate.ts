import type { QueryClient } from "@tanstack/react-query";

/**
 * Every view that shows invoice/payment/balance data. Recording or deleting a
 * payment touches the invoice, the policy chain, the client's covers and
 * billing tab, the policies list and the dashboard — so refresh them all.
 */
export function invalidatePaymentViews(qc: QueryClient, invoiceId?: string) {
  const keys = [
    "invoices",
    "policies",
    "policy",
    "policy-chain-invoices",
    "client-vehicles",
    "client-billing",
    "dashboard",
    "renewals",
  ];
  if (invoiceId) qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  else qc.invalidateQueries({ queryKey: ["invoice"] });
  for (const k of keys) qc.invalidateQueries({ queryKey: [k] });
}
