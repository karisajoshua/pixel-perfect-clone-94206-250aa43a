import { createFileRoute } from "@tanstack/react-router";

// IPEN → us callback for M-Pesa Express results. Mirrors mpesa-callback.ts
// but receives IPEN's own ProcessExpressCallback shape.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-ipen-callback-secret",
} as const;

export const Route = createFileRoute("/api/public/ipen/process-express-callback")({
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

        const checkoutId =
          payload?.checkoutRequestId ??
          payload?.CheckoutRequestID ??
          payload?.checkoutId ??
          null;
        const status =
          payload?.status ?? payload?.Status ?? payload?.resultCode ?? null;
        const reference =
          payload?.mpesaReceiptNumber ??
          payload?.MpesaReceiptNumber ??
          payload?.transactionRef ??
          null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (checkoutId) {
          const patch: Record<string, unknown> = {};
          if (reference) {
            patch.ipen_transaction_ref = String(reference);
            patch.reference = String(reference);
          }
          if (Object.keys(patch).length > 0) {
            await supabaseAdmin
              .from("payments")
              .update(patch)
              .eq("ipen_checkout_request_id", String(checkoutId));
          }
        }

        console.log("[ipen.process_express_callback]", { checkoutId, status, reference });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});