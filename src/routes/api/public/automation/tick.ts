import { createFileRoute } from "@tanstack/react-router";

/**
 * Automation scheduler tick — invoked every minute by pg_cron.
 * Bounded work per call: scheduled-event scan, ≤25 events, ≤25 jobs, ~20s budget.
 * Protected by a shared secret header (x-automation-secret), same pattern as the renewal hook.
 */
async function handle(request: Request) {
  const provided = request.headers.get("x-automation-secret") ?? "";
  const expected = process.env.AUTOMATION_TICK_SECRET ?? "";
  if (!expected || provided !== expected) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runTick } = await import("@/lib/automation/engine.server");
  const result = await runTick(supabaseAdmin);
  return Response.json(result);
}

export const Route = createFileRoute("/api/public/automation/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
