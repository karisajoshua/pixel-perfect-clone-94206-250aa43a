import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Wraps the generated Supabase auth middleware and additionally enforces the
 * second factor on the server. If the signed-in user has a verified MFA factor
 * enrolled, their token must have been stepped up to aal2 — otherwise the call
 * is rejected, even when the UI gate is bypassed.
 */
export const requireAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, claims } = context as any;
    const aal = (claims as any)?.aal as string | undefined;
    if (aal !== "aal2") {
      const { data } = await supabase.auth.mfa.listFactors();
      const enrolled = [
        ...((data?.totp ?? []) as any[]),
        ...(((data as any)?.phone ?? []) as any[]),
      ].some((f: any) => f?.status === "verified");
      if (enrolled) {
        throw new Error("Unauthorized: two-factor verification required");
      }
    }
    return next();
  });
