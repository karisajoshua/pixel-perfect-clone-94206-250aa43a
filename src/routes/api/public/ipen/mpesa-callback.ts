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
          const patch: Record<string, any> = {};
          if (mpesaReceipt) patch.ipen_transaction_ref = String(mpesaReceipt);
          if (resultCode === 0 || resultCode === "0") {
            patch.paid_at = new Date().toISOString();
          }
          if (Object.keys(patch).length > 0) {
            await supabaseAdmin
              .from("payments")
              .update(patch)
              .eq("ipen_checkout_request_id", String(checkoutId));
          }
        }

        // Log for audit; failure to log must not fail the callback.
        try {
          await supabaseAdmin.from("audit_log").insert({
            action: "ipen.mpesa_callback",
            entity_type: "payment",
            entity_id: checkoutId ?? null,
            meta: {
              result_code: resultCode,
              result_desc: resultDesc,
              mpesa_receipt: mpesaReceipt,
              payload,
            },
          } as any);
        } catch {}

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});