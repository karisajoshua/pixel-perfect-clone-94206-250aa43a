import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";
import { ipenFetch } from "./ipen-fetch.server";

const idLike = z.union([z.string(), z.number()]);

export const listIpenClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Claim/user-claims",
      method: "GET",
    });
    if (!res.ok)
      return { error: res.error ?? "Failed to load claims", upstreamOutage: res.upstreamOutage ?? res.status >= 500, status: res.status } as any;
    return res.data;
  });

export const getIpenClaim = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ claimId: idLike }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: `/api/Claim/claim-details/${encodeURIComponent(String(data.claimId))}`,
      method: "GET",
    });
    if (!res.ok)
      return { error: res.error ?? "Failed to load claim", upstreamOutage: res.upstreamOutage ?? res.status >= 500, status: res.status } as any;
    return res.data;
  });

export const createIpenClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        claimDate: z.string(),
        dateOfLoss: z.string(),
        reportedDate: z.string().optional(),
        claimDetails: z.string().min(1),
        insuredItemId: idLike,
        policyId: idLike,
        reportedToPolice: z.boolean(),
        riskLocation: z.string().min(1),
        localClaimId: z.string().uuid().optional(),
      })
      .passthrough()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { localClaimId, ...body } = data as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Claim/create-claim",
      method: "POST",
      body,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to create claim");
    if (localClaimId) {
      const remoteId = res.data?.claimId ?? res.data?.id ?? res.data?.data?.claimId ?? null;
      if (remoteId) {
        await supabase
          .from("claims")
          .update({ ipen_claim_id: String(remoteId) })
          .eq("id", localClaimId);
      }
    }
    return res.data;
  });