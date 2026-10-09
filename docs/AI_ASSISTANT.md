# AI assistant — implementation notes

## Two source-visible experiences

1. **Agency assistant:** `src/routes/_authenticated/assistant.tsx` invokes `ipenAssistantChat` from `src/lib/ipen/assistant.functions` using a TanStack server function. The page describes an IPEN-powered assistant for quotes, coverage and policy questions.
2. **In-app chat API:** `src/routes/api/chat.ts` uses the AI SDK, `streamText`, Zod-validated tools, an AI gateway provider, and a prompt including `docsAsContext()`. Tool definitions query Supabase records such as clients, policies, claims and invoices. The configured model identifier in inspected code is `google/gemini-3-flash-preview`.

These are **distinct code paths**. Their production authentication and tool-level authorization must be independently reviewed.

## Required safeguards
- Build database clients with the authenticated user's identity and enforce RLS for every tool.
- Reject unauthenticated and cross-tenant access at the server boundary.
- Limit exposed fields, message size, tool-call counts, output length and cost.
- Defend against prompt injection from records and documents.
- Prevent model-generated statements from being mistaken for policy binding, pricing or claims decisions.
- Log minimal metadata without customer PII; define retention and consent.
- Test role-specific responses with synthetic tenant data.

## Verification status
**Confirmed:** assistant UI, server function reference, AI SDK route and database-query tool definitions. **Not confirmed:** effective RLS, endpoint authorization, provider credentials, runtime success, data retention and cost limits.
