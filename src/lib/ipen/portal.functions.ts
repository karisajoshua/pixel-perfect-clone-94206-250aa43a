import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipenFetch } from "./ipen-fetch.server";

export const getIpenPortalDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Portal/dashboard",
      method: "GET",
    });
    if (!res.ok)
      return { error: res.error ?? "Failed to load IPEN portal", upstreamOutage: res.upstreamOutage ?? res.status >= 500, status: res.status } as any;
    return res.data;
  });