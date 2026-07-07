import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipenFetch } from "./ipen-fetch.server";

const idLike = z.union([z.string(), z.number()]);

export const initiateMpesaExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        proposalId: idLike,
        phoneNumber: z.string().min(1),
        amount: z.union([z.string(), z.number()]),
        localPaymentId: z.string().uuid().optional(),
      })
      .passthrough()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { localPaymentId, ...body } = data as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Policy/initialize-payment",
      method: "POST",
      body,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to initiate M-Pesa payment");
    if (localPaymentId) {
      const checkoutId =
        res.data?.checkoutRequestId ?? res.data?.CheckoutRequestID ?? null;
      if (checkoutId) {
        await supabase
          .from("payments")
          .update({ ipen_checkout_request_id: String(checkoutId) })
          .eq("id", localPaymentId);
      }
    }
    return res.data;
  });

export const confirmMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ proposalId: idLike }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: `/api/PaymentDetails/ConfirmMpesaPayment/${encodeURIComponent(String(data.proposalId))}`,
      method: "POST",
      body: {},
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to confirm payment");
    return res.data;
  });

// Direct M-Pesa Express initiation (some flows use this instead of policy/initialize-payment).
export const initiateMpesaExpressDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({}).passthrough().parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/PaymentDetails/InitiateMpesaExpress",
      method: "POST",
      body: data,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to initiate STK push");
    return res.data;
  });