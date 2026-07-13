import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadIpenCredentialForUser } from "./agency-credentials.server";

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
    const { userId } = context as any;
    const cred = await loadIpenCredentialForUser(userId);
    if (!cred?.access_token) {
      throw new Error("Agency IPEN is not connected. Ask an admin to connect in Admin → IPEN.");
    }
    const base = (process.env.IPEN_API_BASE_URL ?? "").replace(/\/$/, "");
    if (!base) throw new Error("IPEN_API_BASE_URL is not configured");

    const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: data.contentType });
    const form = new FormData();
    form.append("File", blob, data.fileName);
    form.append("DocumentType", data.documentType);

    const res = await fetch(`${base}/api/Ocr/extract-data`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${cred.access_token}`,
      },
      body: form,
    });
    const text = await res.text();
    let parsed: any = null;
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }
    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === "object" && (parsed.title || parsed.message || parsed.error)) ||
        (typeof parsed === "string" ? parsed : `OCR failed (${res.status})`);
      throw new Error(String(msg));
    }
    return parsed;
  });