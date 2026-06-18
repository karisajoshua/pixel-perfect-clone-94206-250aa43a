
## Goal
Four changes: (1) make the app mobile-friendly, (2) stamp the Zest contact block on every invoice/quotation PDF, (3) ship comprehensive in-app documentation (admin hub + per-dashboard help), and (4) add an AI assistant that can answer questions and deep-link to the right page.

## 1. Mobile optimization
Audit and fix the highest-traffic surfaces for ≤390px width:
- `src/components/app-shell.tsx` — sidebar collapses into a `Sheet` drawer triggered by a top-bar hamburger; main content padding shrinks (`p-4 md:p-8`); footer text wraps.
- `src/components/page-header.tsx` — stack title/subtitle/actions vertically on mobile (`flex-col sm:flex-row`).
- All data tables in `_authenticated/*` (clients, policies, invoices, claims, quotations, renewals, vehicles, admin.users, admin.branches, etc.) — wrap in `overflow-x-auto` and hide non-essential columns under `hidden md:table-cell`.
- Form dialogs (`client-form-dialog`, `invoice-form-dialog`, `policy-form-dialog`, `vehicle-form-dialog`) — switch fixed grid layouts to `grid-cols-1 sm:grid-cols-2`, make `DialogContent` `max-h-[90vh] overflow-y-auto`.
- Dashboard tiles (`_authenticated/dashboard.tsx`) — already responsive; verify tap targets ≥44px.
- Landing page (`src/routes/index.tsx`) — verify the split-screen auth form already collapses (it does — just polish spacing).
- Portal shell (`src/components/portal/portal-shell.tsx`) — same drawer pattern.

## 2. Contact block on PDFs
Add a constant `AGENCY_CONTACT` used as fallback when no branch is loaded, and always render the address line in the footer:

```
Ruai, Miranje Hse, Nairobi, Kenya  •  +254 713 985230  •  info@zestinsurance.co.ke
```

Edits:
- `src/lib/invoice-pdf.ts` — when `branch` is null/empty, use AGENCY_CONTACT for the FROM block; add a second footer line above "Powered by Texcortech Systems" with the full contact string.
- `src/lib/quotation-pdf.ts` — same treatment.

## 3. In-app documentation

### 3a. Admin documentation hub
New route `src/routes/_authenticated/admin.docs.tsx` — a searchable, sectioned documentation page covering:
- Getting started (branches → users → clients)
- Clients & KYC
- Vehicles
- Policies & renewals
- Quotations
- Invoices & payments
- Claims workflow
- Reports
- Admin: branches, users/roles, insurers, emails, notifications, audit, import
- Client portal overview
- Email templates & transactional sending
- PDF documents
- AI assistant usage
- FAQ & troubleshooting

Add a nav entry "Documentation" in the admin section of `app-shell.tsx`.

### 3b. Per-dashboard guidance
New component `src/components/help-panel.tsx` — a small `HelpCircle` button in `PageHeader` that opens a `Sheet` showing page-specific tips. Each route passes a short `help` prop (markdown-ish string) describing what the page does, common actions, and links to the relevant section of `/admin/docs`.

Wire `help` into: dashboard, clients, vehicles, policies, quotations, invoices, claims, renewals, reports, admin.* pages, and portal pages.

## 4. AI Assistant
A floating chat button (bottom-right, every authenticated page) opens a Sheet with a chat UI powered by Lovable AI Gateway (`google/gemini-3-flash-preview`).

- Server function `src/lib/ai-assistant.functions.ts` using `createServerFn` + AI SDK + `createLovableAiGatewayProvider` (stack-modern pattern). System prompt embeds the documentation index + a map of `{topic → route}` so the model can suggest navigation.
- Tools (AI SDK `tool()` with `inputSchema`):
  - `navigate_to(route)` — returns a suggested route the UI renders as a "Go to {page}" button.
  - `search_docs(query)` — returns the matching doc section text.
- Client component `src/components/ai-assistant.tsx` — floating button + Sheet, uses `useChat` against a server route `src/routes/api/chat.ts` streaming via `toUIMessageStreamResponse`. Conversation is one-session (no persistence) to keep scope tight.
- Renders markdown responses; tool-call results render as actionable buttons (navigate, open doc section).

Mount the assistant inside `app-shell.tsx` so it appears on every internal page (skip on portal unless requested).

## Files to create
- `src/routes/_authenticated/admin.docs.tsx`
- `src/components/help-panel.tsx`
- `src/components/ai-assistant.tsx`
- `src/lib/ai-assistant.functions.ts`
- `src/lib/ai-gateway.server.ts` (gateway helper)
- `src/routes/api/chat.ts` (streaming chat endpoint)
- `src/lib/docs/content.ts` (single source of truth for doc sections, consumed by both the docs page and the AI system prompt)

## Files to edit
- `src/components/app-shell.tsx` (mobile drawer, docs nav, mount AI assistant, footer wrap)
- `src/components/portal/portal-shell.tsx` (mobile drawer)
- `src/components/page-header.tsx` (mobile stack + help button slot)
- `src/lib/invoice-pdf.ts` (contact footer)
- `src/lib/quotation-pdf.ts` (contact footer)
- Each `_authenticated/*.tsx` route (pass `help` prop; minor table responsiveness)
- Form dialogs listed above (responsive grids)

## Technical notes
- AI assistant uses Lovable AI Gateway — no user-supplied keys.
- Help panel content lives alongside doc sections in `src/lib/docs/content.ts` so docs and tooltips stay in sync.
- Mobile work is presentation-only — no business logic changes.
- Conversation history is in-memory per session; can promote to DB later if you want persistent threads.
