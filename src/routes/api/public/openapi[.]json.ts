import { createFileRoute } from "@tanstack/react-router";
import spec from "../../../../public/openapi.json";

/**
 * Machine-readable API description (OpenAPI 3.1), for documentation tools
 * such as ReadMe. Regenerate with `bun run scripts/generate-openapi.ts`.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const Route = createFileRoute("/api/public/openapi.json")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        new Response(JSON.stringify(spec), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            ...CORS,
          },
        }),
    },
  },
});
