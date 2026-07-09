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
    if (!res.ok) throw new Error(res.error ?? "Failed to load IPEN portal");
    return res.data;
  });