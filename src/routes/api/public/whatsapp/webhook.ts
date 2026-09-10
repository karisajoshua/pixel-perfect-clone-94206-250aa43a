import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta WhatsApp Cloud API webhook.
 *  GET  — subscription verification (hub.challenge)
 *  POST — delivery statuses + inbound messages, signature-verified and idempotent.
 * External caller, so it lives under /api/public/* and authenticates itself.
 */

async function verify(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = process.env["WHATSAPP_VERIFY_TOKEN"] ?? "";
  if (!expected) return new Response("Webhook verify token not configured", { status: 503 });
  if (mode === "subscribe" && token === expected) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

async function receive(request: Request) {
  const raw = await request.text();
  const appSecret = process.env["WHATSAPP_APP_SECRET"] ?? "";
  const { verifyMetaSignature } = await import("@/lib/whatsapp/provider.server");
  const ok = await verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), appSecret);
  if (!ok) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { processWhatsAppWebhook } = await import("@/lib/whatsapp/inbound.server");
  try {
    const stats = await processWhatsAppWebhook(supabaseAdmin, payload);
    // Always 200 on handled payloads so Meta does not replay indefinitely.
    return Response.json({ ok: true, ...stats });
  } catch (e: any) {
    console.error("[whatsapp webhook]", e?.message ?? e);
    return Response.json({ ok: false }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => verify(request),
      POST: async ({ request }) => receive(request),
    },
  },
});
