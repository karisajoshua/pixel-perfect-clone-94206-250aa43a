import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipenFetch } from "./ipen-fetch.server";

export const ipenOcrExtract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        documentType: z.string().min(1),
        fileName: z.string().min(1),
        contentType: z.string().min(1),
        fileBase64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Ocr/extract-data",
      method: "POST",
      body: data,
    });
    if (!res.ok) throw new Error(res.error ?? "OCR failed");
    return res.data;
  });