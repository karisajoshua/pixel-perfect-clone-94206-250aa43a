## Goal
On `/admin/ipen`, surface every IPEN endpoint group we've integrated — not just Reference data — so admins/managers can see and try each service from one place.

## What I'll change

Extend `src/routes/_authenticated/admin.ipen.tsx`. Keep the Connection card and the existing Reference explorer. Add a new **"IPEN services"** card below Reference data with a tabbed explorer covering every module already wired to server functions:

1. **Policies** — list live policies (`listIpenPolicies`), open policy live drawer, motor & life quote wizards launch buttons.
2. **Claims** — list claims (`listIpenClaims`), "File claim" launcher (existing dialog).
3. **Payments (M-Pesa)** — "Initiate STK push" mini form (`initiateMpesaExpress`) + recent payment status lookup (`getPaymentStatus`).
4. **Documents** — list uploaded documents (`listIpenDocuments`), open link helper.
5. **OCR** — file input → run OCR (`runIpenOcr`) → show extracted JSON.
6. **Profile** — show IPEN profile (`getIpenProfile`), inline edit fields (`updateIpenProfile`).
7. **Portal** — dashboard widget preview (`getPortalDashboard`).
8. **Assistant** — link/button to `/assistant` (already implemented) + one-shot ask box (`askIpenAssistant`).
9. **Health** — keep existing pill; add "Ping /health" button.

Each tab uses the same pattern as `RefList`: React Query + JSON preview + Refresh, plus small inline forms where an input is required (STK push, OCR upload, assistant question).

No backend or schema changes. All server functions already exist under `src/lib/ipen/*.functions.ts`; this is purely a UI surface expansion.

## Files touched
- `src/routes/_authenticated/admin.ipen.tsx` — add `ServicesExplorer` component and mount it under the Connection card when `connected` is true.

## Out of scope
- Auth flow changes, RLS changes, new endpoints, styling overhaul.
