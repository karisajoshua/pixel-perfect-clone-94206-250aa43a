# Surface the rest of the IPEN v1 integration in the UI

The server-fn wrappers and components are already built, but several are orphaned. This plan wires each one into a visible surface, mirroring how the reference-data explorer is exposed on `/admin/ipen`.

## What's currently wired vs orphan

Wired: assistant page (sidebar), motor quote wizard (client detail), file-claim dialog (claims), policy live drawer (policy detail), portal dashboard widget + profile panel (client portal), reference explorer + connect flow (admin IPEN).

Orphan (built but not shown anywhere): life quote wizard, OCR button, document-link helper, process-payment, life benefits schedule, forgot-password, Google sign-in, health probe.

## Changes by surface

### 1. Quotations page (`/quotations`)
- Add a second "New IPEN quote" split button next to the existing New quote: **Motor** (opens `IpenMotorQuoteWizard`) and **Life** (opens `IpenLifeQuoteWizard`) with a client picker at the top of each wizard.
- On successful IPEN quote, insert a row into local `quotations` with `source = 'ipen'` and the returned premium so it shows on the dashboard.

### 2. Policy detail (`/policies/$id`)
- Add a **Process payment** button (STK push / express) that calls the process-payment server fn and shows the M-Pesa prompt state; use the existing `process-express-callback` route as the callback URL.
- For life policies, add a **Benefits schedule** card that renders the schedule from the life-benefits fn.
- Add a **Documents** sub-tab listing IPEN documents for the policy using `DocumentLink` (open/download from IPEN).

### 3. Client detail (`/clients/$id`)
- Add an **OCR scan** action in the KYC section using `OcrButton` — upload ID / KRA image, prefill fields from the OCR response with a review dialog before saving.

### 4. Assistant page (`/assistant`)
- Already visible. No change beyond a small empty-state prompt list.

### 5. Auth page (`/auth`)
- Add **Sign in with Google** button (existing IPEN google sign-in fn) and a **Forgot password** link that calls the IPEN forgot-password fn and shows a success toast.

### 6. Admin IPEN page (`/admin/ipen`)
- Add a small **Service health** pill at the top powered by the health-probe fn, refreshing every 60s.
- Add a **Live features** card below reference data with quick-launch buttons: Motor quote, Life quote, OCR test, Documents lookup — same pattern as the reference explorer, so admins can smoke-test each surface.

## Technical notes

- All new buttons call existing server fns via `useServerFn` + React Query mutations; no new server code.
- Reuse the "connected + MFA satisfied" guard already used by the reference explorer — hide/disable live actions when `mfa_required` or no access token.
- For the Google sign-in and forgot-password flows, expose them only on `/auth` (not inside authenticated routes).
- Toast on failure using the shared `toast` helper; surface `upstreamOutage` errors with the friendly 502 message already added in `ipen-fetch.server.ts`.
- No DB migrations. No changes to `src/integrations/supabase/*`.

## Out of scope

- Any redesign of existing panels.
- Changing IPEN auth/MFA flow.
- Adding new IPEN endpoints (only wiring what's built).
