import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";
import { ipenFetch } from "./ipen-fetch.server";

// Returns the IPEN document as base64 so the browser can render/download it
// without ever holding the bearer token. contentType is best-effort — falls
// back to application/octet-stream.
export const getIpenDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: `/api/Documents/content/${encodeURIComponent(data.key)}`,
      method: "GET",
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to load document");
    // Response may be raw base64 string, {content, contentType}, or JSON with data.
    const raw: any = res.data;
    let base64 = "";
    let contentType = "application/octet-stream";
    if (typeof raw === "string") base64 = raw;
    else if (raw && typeof raw === "object") {
      base64 = raw.content ?? raw.base64 ?? raw.data ?? raw.fileContents ?? "";
      contentType = raw.contentType ?? raw.mimeType ?? contentType;
    }
    return { base64: String(base64 ?? ""), contentType };
  });