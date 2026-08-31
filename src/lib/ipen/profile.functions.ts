import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipenFetch } from "./ipen-fetch.server";

export const getIpenProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Profile/profile",
      method: "GET",
    });
    if (!res.ok)
      return { error: res.error ?? "Failed to load profile", upstreamOutage: res.upstreamOutage ?? res.status >= 500, status: res.status } as any;
    return res.data;
  });

export const updateIpenProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({}).passthrough().parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Profile/profile",
      method: "POST",
      body: data,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to update profile");
    return res.data;
  });

export const uploadIpenProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        fileName: z.string().min(1),
        contentType: z.string().min(1),
        fileBase64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Profile/upload-profile-photo",
      method: "POST",
      body: data,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to upload photo");
    return res.data;
  });