import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { docsAsContext } from "@/lib/docs/content";

const SYSTEM_PROMPT = `You are the Zest Insurance Agency in-app assistant. You help staff and clients navigate the agency management app.

Answer concisely (1-4 short paragraphs). When the user wants to do something in the app, tell them which page to open and reference the route path in backticks like \`/clients\` so the UI can render a navigation button.

Only answer using the documentation below. If the answer is not in the docs, say so and suggest the closest related page.

--- APP DOCUMENTATION ---
${docsAsContext()}
--- END DOCUMENTATION ---`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});