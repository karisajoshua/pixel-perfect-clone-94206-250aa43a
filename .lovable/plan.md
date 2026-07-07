## IPEN (AfricaBima) API integration — Phase 1

Integrate the IPEN sandbox API (`https://ipen-api-sandbox.africabima.com`) into the staff quoting workflow. Per-user IPEN login, hybrid storage (IDs kept locally, details fetched live), server-side proxy so the IPEN token never touches the browser.

### 1. Credentials & token storage

- New table `public.ipen_credentials` (per user):
  - `user_id` (PK, FK → `auth.users`)
  - `ipen_email`, `access_token`, `refresh_token`, `token_expires_at`, `last_login_at`
- RLS: user reads/writes only their own row. `service_role` full access. No `anon` access.
- Add a "Connect IPEN account" panel under **Settings / Profile** where an agent enters their IPEN email + password once; on success we store the returned tokens.
- Store the `IPEN_API_BASE_URL` as a runtime secret so we can flip sandbox → production later without a redeploy.

### 2. Server proxy layer (`createServerFn`)

All IPEN calls go through TanStack server functions — never called from the browser directly.

New files:
- `src/lib/ipen/client.server.ts` — thin `fetch` wrapper: reads the caller's stored token, auto-refreshes via `/api/Auth/refresh-token` on 401, re-persists new tokens, returns typed JSON.
- `src/lib/ipen/auth.functions.ts` — `connectIpen`, `disconnectIpen`, `ipenStatus` (login/register/logout/MFA-verify).
- `src/lib/ipen/common.functions.ts` — cached reference data: countries, genders, identification documents, relationships, risk-class categories, motor types, vehicle makes/models, vehicle uses. Cached per-process for 12 h.
- `src/lib/ipen/policies.functions.ts` — `generateMotorQuotes`, `getCoverOptions`, `confirmQuote`, `listPolicies`, `getPolicy`, `getProducts(riskClass)`, life-product equivalents.
- `src/lib/ipen/claims.functions.ts` — `listClaims`, `getClaim`, `createClaim`.
- `src/lib/ipen/payments.functions.ts` — `initiateMpesaExpress`, `confirmMpesaPayment`, `processPayment`.

All functions use `.middleware([requireSupabaseAuth])` so the calling user is known and RLS on `ipen_credentials` applies.

### 3. M-Pesa callback (public route)

- `src/routes/api/public/ipen/mpesa-callback.ts` — receives `ProcessExpressCallback` from IPEN, verifies a shared `IPEN_CALLBACK_SECRET` header (configured on the IPEN side), updates the local `payments`/`invoices` row that carries the proposal reference.

### 4. UI touchpoints (staff quoting flow only)

- **Clients → new "Get IPEN Motor Quote" action** on a client detail page:
  - Wizard: pick vehicle (from local `vehicles` or search IPEN `customer-vehicles`) → risk class → cover options → generate quotes → pick insurer/product → confirm → initiate M-Pesa STK push.
  - On confirm we save `ipen_proposal_id` / `ipen_policy_id` onto our local `quotations` / `policies` row (hybrid model — details still fetched live).
- **Policies list**: add an "IPEN" badge + "View live details" drawer that calls `getPolicy(ipen_policy_id)`.
- **Claims → "File via IPEN"** button that calls `createClaim` and stores the returned `ipen_claim_id` on our `claims` row.
- **Admin → Insurers / Reference** page: a read-only viewer of IPEN reference data so staff can confirm the sandbox is reachable.

### 5. Local schema additions

Add nullable columns (no data migration needed):
- `quotations.ipen_proposal_id text`, `ipen_quote_payload jsonb`
- `policies.ipen_policy_id text`
- `claims.ipen_claim_id text`
- `payments.ipen_transaction_ref text`, `ipen_checkout_request_id text`

### 6. Secrets to add

- `IPEN_API_BASE_URL` = `https://ipen-api-sandbox.africabima.com` (set via `set_secret`)
- `IPEN_CALLBACK_SECRET` (generated) — verified on the M-Pesa callback route

### Out of scope for this phase

- Client portal surfacing IPEN data (staff-only for now).
- Full sync/mirror job — we keep the hybrid model.
- Life-insurance quoting UI (server functions are added, but no wizard yet).
- Assistant, Portal/dashboard, Documents/content, Profile-photo upload endpoints.

### Open items I'll confirm during build

- Exact request/response shapes per endpoint (I'll pull the OpenAPI JSON at `…/openapi/v1.json` before writing each function).
- Whether IPEN's login returns MFA challenge — if yes, the connect dialog gets an OTP step.
