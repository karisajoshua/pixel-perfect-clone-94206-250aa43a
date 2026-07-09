import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipenFetch } from "./ipen-fetch.server";

export const ipenAssistantChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        message: z.string().min(1),
        history: z
          .array(z.object({ role: z.string(), content: z.string() }))
          .optional()
          .default([]),
        intent: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Assistant/chat",
      method: "POST",
      body: data,
    });
    if (!res.ok) throw new Error(res.error ?? "Assistant unavailable");
    return res.data;
  });