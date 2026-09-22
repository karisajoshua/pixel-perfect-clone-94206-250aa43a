/**
 * Provider-neutral payment contract for automation journeys.
 *
 * WhatsApp and other channels emit payment.requested. A configured payment
 * adapter may translate that into M-Pesa STK, a hosted checkout link, card,
 * bank or another supported method. Only a trusted provider callback/service
 * may emit payment.confirmed.
 */
export type PaymentRequestEvent = {
  source: "whatsapp" | "portal" | "admin" | string;
  conversation_id?: string;
  quotation_id?: string;
  policy_id?: string;
  vehicle_id?: string;
  client_id?: string;
  amount: number;
  currency: string;
  phone?: string;
};

export type PaymentConfirmedEvent = {
  payment_id: string;
  quotation_id?: string;
  policy_id?: string;
  amount: number;
  currency: string;
  reference: string;
  provider: string;
};

export const PAYMENT_REQUESTED_EVENT = "payment.requested" as const;
export const PAYMENT_CONFIRMED_EVENT = "payment.confirmed" as const;
