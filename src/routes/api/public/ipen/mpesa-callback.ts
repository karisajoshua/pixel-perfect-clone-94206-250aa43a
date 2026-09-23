import { createFileRoute } from "@tanstack/react-router";

// IPEN M-Pesa Express callback receiver.
//
// Configure IPEN (or an intermediary) to POST here with header
//   x-ipen-callback-secret: <IPEN_CALLBACK_SECRET>
// so we can trust the payload. We match the incoming CheckoutRequestID
// to a local payments row and record the outcome.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-ipen-callback-secret",
} as const;

export const Route = createFileRoute("/api/public/ipen/mpesa-callback")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const expected = process.env.IPEN_CALLBACK_SECRET ?? "";
        const provided = request.headers.get("x-ipen-callback-secret") ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        let payload: any = null;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        // Try common M-Pesa STK callback shapes.
        const stk = payload?.Body?.stkCallback ?? payload?.stkCallback ?? payload;
        const checkoutId =
          stk?.CheckoutRequestID ??
          stk?.checkoutRequestId ??
          payload?.checkoutRequestId ??
          null;
        const resultCode =
          stk?.ResultCode ?? stk?.resultCode ?? payload?.resultCode ?? null;
        const resultDesc =
          stk?.ResultDesc ?? stk?.resultDesc ?? payload?.resultDesc ?? null;
        const items: any[] =
          stk?.CallbackMetadata?.Item ?? stk?.callbackMetadata?.item ?? [];
        const mpesaReceipt =
          items.find((i: any) => i?.Name === "MpesaReceiptNumber")?.Value ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (checkoutId) {
          const patch: {
            ipen_transaction_ref?: string;
            reference?: string;
          } = {};
          if (mpesaReceipt) {
            patch.ipen_transaction_ref = String(mpesaReceipt);
            patch.reference = String(mpesaReceipt);
          }
          if (Object.keys(patch).length > 0) {
            const { data: payment, error: paymentError } = await supabaseAdmin
              .from("payments")
              .update(patch)
              .eq("ipen_checkout_request_id", String(checkoutId))
              .select("id,tenant_id,client_id,policy_id,invoice_id,amount,reference")
              .maybeSingle();

            if (paymentError) {
              console.error("[ipen.mpesa_callback] payment update failed", paymentError.message);
            }

            // The verified provider callback is the only authority that advances
            // certificate payment state. Chat/admin UI cannot call this RPC.
            if (payment && Number(resultCode) === 0 && mpesaReceipt && payment.policy_id) {
              const { data: order } = await supabaseAdmin
                .from("dmvic_certificate_orders")
                .select("id,selling_price,payment_status,status")
                .eq("policy_id", payment.policy_id)
                .eq("status", "awaiting_payment")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (order && order.payment_status !== "confirmed") {
                const paidAmount = Number(payment.amount ?? 0);
                const dueAmount = Number(order.selling_price ?? 0);
                if (paidAmount !== dueAmount) {
                  console.error("[ipen.mpesa_callback] certificate payment amount mismatch", {
                    paymentId: payment.id,
                    orderId: order.id,
                    paidAmount,
                    dueAmount,
                  });
                } else {
                  const { error: confirmError } = await supabaseAdmin.rpc("dmvic_confirm_payment", {
                    p_order_id: order.id,
                    p_reference: String(mpesaReceipt),
                    p_provider: "ipen_mpesa",
                    p_amount: paidAmount,
                    p_idempotency_key: `ipen:${checkoutId}`,
                  });
                  if (confirmError) {
                    console.error("[ipen.mpesa_callback] certificate payment confirmation failed", confirmError.message);
                  } else {
                    const { error: eventError } = await supabaseAdmin.from("automation_events").insert({
                      tenant_id: payment.tenant_id,
                      event_type: "certificate.payment_confirmed",
                      entity_type: "dmvic_certificate_order",
                      entity_id: order.id,
                      client_id: payment.client_id,
                      dedupe_key: `ipen:certificate-payment-confirmed:${checkoutId}`,
                      payload: {
                        order_id: order.id,
                        payment_id: payment.id,
                        policy_id: payment.policy_id,
                        amount: paidAmount,
                        reference: String(mpesaReceipt),
                        provider: "ipen_mpesa",
                      },
                    });
                    if (eventError && eventError.code !== "23505") {
                      console.error("[ipen.mpesa_callback] certificate event insert failed", eventError.message);
                    }

                    const { data: paidOrder } = await supabaseAdmin
                      .from("dmvic_certificate_orders")
                      .select("id,validation_payload")
                      .eq("id", order.id)
                      .eq("status", "paid")
                      .maybeSingle();
                    if (paidOrder?.validation_payload) {
                      const { issuePaidCertificateOrder } = await import("@/lib/dmvic/certificate-orders.functions");
                      try {
                        const issuance = await issuePaidCertificateOrder({
                          db: supabaseAdmin,
                          orderId: paidOrder.id,
                          input: paidOrder.validation_payload,
                        });
                        console.log("[ipen.mpesa_callback] certificate issuance transition", {
                          orderId: paidOrder.id,
                          status: issuance.status,
                        });
                      } catch (issuanceError) {
                        console.error(
                          "[ipen.mpesa_callback] certificate issuance orchestration failed",
                          issuanceError instanceof Error ? issuanceError.message : "Unknown error",
                        );
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Log to server for observability — audit_log requires tenant scoping so
        // we don't insert from an unauthenticated public callback.
        console.log("[ipen.mpesa_callback]", {
          checkoutId,
          resultCode,
          resultDesc,
          mpesaReceipt,
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});