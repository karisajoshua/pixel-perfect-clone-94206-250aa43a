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
            const { data: payment } = await supabaseAdmin
              .from("payments")
              .update(patch)
              .eq("ipen_checkout_request_id", String(checkoutId))
              .select("id,tenant_id,client_id,policy_id,invoice_id,amount,reference")
              .maybeSingle();
            // A successful provider callback is the authoritative trigger for the
            // next automation stage. Customer chat messages never mark payment paid.
            if (payment && Number(resultCode) === 0 && mpesaReceipt) {
              await supabaseAdmin.from("automation_events").insert({
                tenant_id: payment.tenant_id,
                event_type: "payment.confirmed",
                entity_type: "payment",
                entity_id: payment.id,
                client_id: payment.client_id,
                dedupe_key: `ipen:payment-confirmed:${checkoutId}`,
                payload: {
                  payment_id: payment.id,
                  policy_id: payment.policy_id,
                  invoice_id: payment.invoice_id,
                  amount: payment.amount,
                  reference: String(mpesaReceipt),
                  checkout_request_id: String(checkoutId),
                },
              });
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