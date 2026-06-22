import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InlineInput = z.object({
  file_data_url: z.string().min(20),
  mime_type: z.string().min(3),
  filename: z.string().optional(),
});
const StoredInput = z.object({
  client_id: z.string().uuid(),
  storage_path: z.string().min(1),
});
const Input = z.union([InlineInput, StoredInput]);

const PROMPT = `You are reading a Kenyan NTSA vehicle log book (or similar vehicle registration document). Extract the fields below from the image/PDF and return ONLY a single minified JSON object — no commentary, no markdown fences.

Keys (use null if not legible / not present):
- registration_no (string, uppercase, no spaces e.g. "KDA123A")
- make (string e.g. "Toyota")
- model (string e.g. "Hilux")
- year (integer year of manufacture)
- body_type (string e.g. "Saloon", "Station Wagon", "Pick-up")
- color (string)
- chassis_no (string, exactly as printed)
- engine_no (string, exactly as printed)
- fuel_type (one of: "petrol","diesel","electric","hybrid")
- seating_capacity (integer)
- cubic_capacity (integer cc)
- usage_type (one of: "private","commercial","psv","hire")

Return strictly valid JSON.`;

async function assertStaff(supabase: any, userId: string) {
  for (const r of ["admin", "manager", "agent"] as const) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) return;
  }
  throw new Error("Forbidden: staff role required");
}

function mimeFromPath(p: string): string {
  const ext = p.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

export const getClientLogbookDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ client_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("client_required_documents")
      .select("doc_type, storage_path, file_name, created_at")
      .eq("client_id", data.client_id)
      .in("doc_type", ["log_book", "importation_doc", "search_doc"])
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!rows || rows.length === 0) return null;
    const priority = ["log_book", "importation_doc", "search_doc"];
    rows.sort((a: any, b: any) => priority.indexOf(a.doc_type) - priority.indexOf(b.doc_type));
    const row = rows[0];
    return { storage_path: row.storage_path as string, file_name: row.file_name as string, doc_type: row.doc_type as string };
  });

export const extractLogbookFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    let fileDataUrl: string;
    let mimeType: string;
    let filename: string | undefined;

    if ("storage_path" in data) {
      await assertStaff(context.supabase, context.userId);
      if (!data.storage_path.startsWith(`${data.client_id}/kyc/`)) {
        throw new Error("Invalid storage path for client");
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from("client-documents")
        .download(data.storage_path);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? "Could not load the stored log book");
      const ab = await blob.arrayBuffer();
      const b64 = Buffer.from(ab).toString("base64");
      mimeType = (blob as any).type || mimeFromPath(data.storage_path);
      fileDataUrl = `data:${mimeType};base64,${b64}`;
      filename = data.storage_path.split("/").pop();
    } else {
      fileDataUrl = data.file_data_url;
      mimeType = data.mime_type;
      filename = data.filename;
    }

    const gateway = createLovableAiGatewayProvider(key);
    const isPdf = mimeType === "application/pdf";

    const content: any[] = [{ type: "text", text: PROMPT }];
    if (isPdf) {
      content.push({
        type: "file",
        data: fileDataUrl,
        mediaType: "application/pdf",
        filename: filename ?? "logbook.pdf",
      });
    } else {
      content.push({ type: "image", image: fileDataUrl });
    }

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      messages: [{ role: "user", content }],
    });

    // Strip code fences if the model returned them
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not read logbook. Try a clearer photo.");
      parsed = JSON.parse(match[0]);
    }

    const allowed = [
      "registration_no","make","model","year","body_type","color","chassis_no",
      "engine_no","fuel_type","seating_capacity","cubic_capacity","usage_type",
    ];
    const out: Record<string, any> = {};
    for (const k of allowed) if (parsed[k] != null && parsed[k] !== "") out[k] = parsed[k];
    if (typeof out.registration_no === "string") out.registration_no = out.registration_no.toUpperCase().replace(/\s+/g, "");
    return out;
  });