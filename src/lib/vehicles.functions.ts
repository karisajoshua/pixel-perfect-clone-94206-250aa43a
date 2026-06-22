import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const Input = z.object({
  file_data_url: z.string().min(20),
  mime_type: z.string().min(3),
  filename: z.string().optional(),
});

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

export const extractLogbookFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const isPdf = data.mime_type === "application/pdf";

    const content: any[] = [{ type: "text", text: PROMPT }];
    if (isPdf) {
      content.push({
        type: "file",
        data: data.file_data_url,
        mediaType: "application/pdf",
        filename: data.filename ?? "logbook.pdf",
      });
    } else {
      content.push({ type: "image", image: data.file_data_url });
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