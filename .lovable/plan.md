
# Full IPEN v1 API integration

Wraps every remaining endpoint in `user-uploads://v1.json` behind typed `createServerFn` handlers and builds the user-facing surfaces for them. All calls tunnel through the existing `ipenFetch` helper so tokens never leave the server. No schema/RLS changes are needed unless noted.

## 1. Server function wrappers (new / updated `src/lib/ipen/*.functions.ts`)

Add wrappers for every endpoint not yet covered. Each uses `requireSupabaseAuth` unless the endpoint is public.

**Auth (`auth.functions.ts`)** — extend existing file
- `POST /api/Auth/forgot-password` → `ipenForgotPassword({ email })`
- `POST /api/Auth/forgot-password/verify-otp` → `ipenForgotPasswordVerify({ email, otp })`
- `POST /api/Auth/forgot-password/reset` → `ipenForgotPasswordReset({ token, newPassword })`
- `POST /api/Auth/login/resend-mfa` → `ipenResendMfa({ mfaToken })`
- `POST /api/Auth/login-with-google` → `ipenLoginWithGoogle({ idToken })` (stores tokens like normal login)

**Assistant (new `assistant.functions.ts`)**
- `POST /api/Assistant/chat` → `ipenAssistantChat({ messages, sessionId? })`, returns the assistant response. Called from the AI Assistant page.

**Documents (new `documents.functions.ts`)**
- `GET /api/Documents/content/{key}` → `getIpenDocument({ key })` — returns `{ contentType, base64 }` so the browser can render/download without exposing the bearer.

**OCR (new `ocr.functions.ts`)**
- `POST /api/Ocr/extract-data` → `ipenOcrExtract({ documentType, fileBase64, fileName })` — multipart translated to base64 on client, JSON on the wire.

**Payments (`payments.functions.ts`)** — extend
- `POST /api/PaymentDetails/ProcessPayment` → `processIpenPayment(payload)`
- `POST /api/PaymentDetails/ProcessExpressCallback` → exposed as public route (see §2) since it is IPEN → us.

**Policies (`policies.functions.ts`)** — extend
- `POST /api/Policy/life-quote-benefits-schedule/{quoteId}` → `getLifeBenefitsSchedule({ quoteId, ...payload })`

**Portal (new `portal.functions.ts`)**
- `GET /api/Portal/dashboard` → `getIpenPortalDashboard()`

**Profile (new `profile.functions.ts`)**
- `GET /api/Profile/profile` → `getIpenProfile()`
- `POST /api/Profile/profile` → `updateIpenProfile(payload)`
- `POST /api/Profile/upload-profile-photo` → `uploadIpenProfilePhoto({ fileBase64, fileName, contentType })`

**Health** — `GET /health` added to `common.functions.ts` as `ipenHealthCheck()`, surfaced on the admin IPEN panel with a green/red pill.

## 2. Public webhook route

`src/routes/api/public/ipen/process-express-callback.ts` — receives `POST /api/PaymentDetails/ProcessExpressCallback` style callbacks from IPEN. Verifies `IPEN_CALLBACK_SECRET` header (already in secrets), maps `checkoutRequestId` → local `payments` row, updates status. Mirrors the existing `mpesa-callback.ts` pattern.

## 3. User-facing surfaces (new routes/components)

### 3a. AI Assistant — `/assistant`
- New route `src/routes/_authenticated/assistant.tsx` using the AI-chat pattern (client `useChat`-style state).
- Chat window streams turns via `ipenAssistantChat`. Message history stored per-session in local component state (persistence out of scope unless you ask for it).
- Sidebar entry "AI Assistant".

### 3b. Life insurance quote wizard — `/quotations` (extended) and portal
- New `src/components/ipen/life-quote-wizard.tsx` mirroring the existing motor wizard: pick product → frequency → applicant/beneficiary details → generate quote → view benefits schedule → confirm.
- Wire into the existing quotations page as a "New life quote" action alongside motor.
- Portal users can also start a life quote from `/portal` (button on dashboard).

### 3c. IPEN Profile — `/portal/profile` addition
- New tab "IPEN account" on existing `/portal/profile` route that shows live IPEN profile (`getIpenProfile`), edit form (`updateIpenProfile`), and avatar upload (`uploadIpenProfilePhoto`).

### 3d. Portal dashboard widget
- On `/portal` index, add a "Live from IPEN" panel using `getIpenPortalDashboard`: counts of active policies, upcoming renewals, recent claims. Skeleton when loading, graceful empty state.

### 3e. OCR-assisted forms
- New shared `IpenOcrButton` component. Drops into:
  - `client-kyc-panel.tsx` (extract from ID/passport upload → autofill name, ID number, DOB).
  - `vehicle-form-dialog.tsx` (extract from logbook → autofill registration, make, model, year, chassis, engine).
- Reads the selected `File`, base64-encodes client-side, calls `ipenOcrExtract`, then applies returned fields to the form via existing state setters. User confirms before save.

### 3f. IPEN document viewer
- New `IpenDocumentLink` component used on claim and policy detail pages. Fetches via `getIpenDocument`, turns base64 into a Blob URL, opens in a new tab.

### 3g. Admin IPEN panel additions (`admin.ipen.tsx`)
- New "Health" pill using `ipenHealthCheck`.
- New "Forgot password / reset" mini-flow inside the connect dialog (three steps: request OTP → verify → set new password) using the new auth functions.
- New "Sign in with Google (IPEN)" button on connect dialog calling `ipenLoginWithGoogle` with a Google ID token obtained via existing Lovable-managed Google popup.
- New "Resend OTP" button in the MFA step wired to `ipenResendMfa`.

## 4. Navigation & metadata
- Sidebar: add "AI Assistant" (authenticated shell) and keep other new surfaces reachable via existing pages.
- Each new route sets its own `head()` title + description; no `og:image` unless a specific hero image exists.

## 5. Verification
- After build: hit `/health` via `ipenHealthCheck` from the admin panel and confirm 200.
- Invoke each new server function via `stack_modern--invoke-server-function` on the preview to smoke-test.
- Manual walkthrough: assistant chat, life quote → benefits → confirm, OCR on a sample logbook, profile edit + photo upload, portal dashboard render, document open, forgot-password flow.

## Technical notes
- Every new `*.functions.ts` file follows the existing pattern: `createServerFn().middleware([requireSupabaseAuth]).inputValidator(zod).handler()`, delegating HTTP to `ipenFetch`. No direct `fetch` from components.
- OCR / profile photo: file is base64-encoded in the browser before hitting the server function to stay within the RPC JSON boundary; if payloads exceed practical limits (>~4 MB) we'll switch that one endpoint to a `src/routes/api/ipen/upload.ts` server route accepting `multipart/form-data` — flagged during implementation, not now.
- Assistant chat: uses standard request/response (not streaming) since the IPEN endpoint is a plain POST. If you want SSE later, we can front it with a TanStack server route.
- No database migrations. `ipen_credentials` already stores what we need; local `payments`/`claims`/`policies` link tables already have `ipen_*_id` columns for correlation.
- Files changed/created (approx): 6 new `*.functions.ts`, 1 new public route, 4 new components, 2 new routes, edits to `admin.ipen.tsx`, `client-kyc-panel.tsx`, `vehicle-form-dialog.tsx`, `portal/index.tsx`, `portal/profile.tsx`, `quotations.tsx`, and the sidebar in `app-shell.tsx`.
