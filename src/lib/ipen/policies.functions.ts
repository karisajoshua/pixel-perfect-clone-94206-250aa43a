import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";
import { ipenFetch } from "./ipen-fetch.server";

const idLike = z.union([z.string(), z.number()]);

export const generateQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        businessType: z.string().optional(),
        riskClassCategoryId: idLike,
        riskClassId: idLike,
        riskClassCoverOptionId: idLike,
        emailAddress: z.string().optional().nullable(),
        phoneNumber: z.string().optional().nullable(),
        registrationNumber: z.string().optional().nullable(),
        vehicleMakeId: idLike.optional(),
        vehicleModelId: idLike.optional(),
        yearOfManufacture: z.union([z.string(), z.number()]).optional(),
        vehicleValue: z.union([z.string(), z.number()]).optional(),
        vehicleUseId: idLike.optional(),
        motorTypeId: idLike.optional(),
        // Pass-through: keep the DTO permissive so we can forward extras.
      })
      .passthrough()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Policy/generate-quotes",
      method: "POST",
      body: data,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to generate quotes");
    return res.data;
  });

export const confirmQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quoteItemId: idLike,
        commencementDate: z.string(),
        localQuotationId: z.string().uuid().optional(),
      })
      .passthrough()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { localQuotationId, ...body } = data as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Policy/confirm-quote",
      method: "POST",
      body,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to confirm quote");

    // Persist IPEN proposal id back to our local quotation, if provided.
    if (localQuotationId) {
      const proposalId =
        res.data?.proposalId ?? res.data?.data?.proposalId ?? res.data?.id ?? null;
      if (proposalId) {
        await supabase
          .from("quotations")
          .update({
            ipen_proposal_id: String(proposalId),
            ipen_quote_payload: res.data as any,
          })
          .eq("id", localQuotationId);
      }
    }
    return res.data;
  });

export const listPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Policy/policies",
      method: "GET",
    });
    if (!res.ok)
      return { error: res.error ?? "Failed to load policies", upstreamOutage: res.upstreamOutage ?? res.status >= 500, status: res.status } as any;
    return res.data;
  });

export const getPolicy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ policyId: idLike }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: `/api/Policy/policy/${encodeURIComponent(String(data.policyId))}`,
      method: "GET",
    });
    if (!res.ok)
      return { error: res.error ?? "Failed to load policy", upstreamOutage: res.upstreamOutage ?? res.status >= 500, status: res.status } as any;
    return res.data;
  });

// Life products (stubs; UI wizard is out of scope for phase 1).
export const listLifeProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Policy/life-products",
      method: "GET",
    });
    if (!res.ok)
      return { error: res.error ?? "Failed to load life products", upstreamOutage: res.upstreamOutage ?? res.status >= 500, status: res.status } as any;
    return res.data;
  });

export const listLifeProductFrequencies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: idLike }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: `/api/Policy/life-product-frequencies/${encodeURIComponent(String(data.productId))}`,
      method: "GET",
    });
    if (!res.ok)
      return { error: res.error ?? "Failed to load frequencies", upstreamOutage: res.upstreamOutage ?? res.status >= 500, status: res.status } as any;
    return res.data;
  });

export const createLifeQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({}).passthrough().parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Policy/create-life-quote",
      method: "POST",
      body: data,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to create life quote");
    return res.data;
  });

export const confirmLifeQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({}).passthrough().parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Policy/confirm-life-quote",
      method: "POST",
      body: data,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to confirm life quote");
    return res.data;
  });

export const getLifeBenefitsSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ quoteId: z.union([z.string(), z.number()]) })
      .passthrough()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { quoteId, ...body } = data as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: `/api/Policy/life-quote-benefits-schedule/${encodeURIComponent(String(quoteId))}`,
      method: "POST",
      body,
    });
    if (!res.ok)
      return { error: res.error ?? "Failed to load benefits schedule", upstreamOutage: res.upstreamOutage ?? res.status >= 500, status: res.status } as any;
    return res.data;
  });