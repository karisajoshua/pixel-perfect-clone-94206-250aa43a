
## API Endpoint → Module Map

Read-only reference. No code changes proposed — if you want this saved as a doc, say so and I'll add it under `docs/`.

### 1. AfricaBima IPEN (`IPEN_API_BASE_URL`, via `src/lib/ipen/ipen-fetch.server.ts`)

**Auth — `src/lib/ipen/auth.functions.ts`** → Admin → IPEN page (`admin.ipen.tsx`)
| Endpoint | Server fn |
|---|---|
| `POST /api/Auth/Register` | `ipenRegister` |
| `POST /api/Auth/Login` | `ipenLogin` |
| `POST /api/Auth/login/verify-mfa` (+ legacy `verify-mfa`, `verify-otp`) | `ipenVerifyMfa` |
| `POST /api/Auth/login/resend-mfa` (+ `resend-otp`, `resend-mfa`) | `ipenResendMfa` |
| `POST /api/Auth/refresh-token` | auto in `ipenFetch` on 401 |
| `POST /api/Auth/logout` | `ipenLogout` |
| `POST /api/Auth/forgot-password` / `/verify-otp` / `/reset` | `ipenForgotPassword*` |
| `POST /api/Auth/login-with-google` | `ipenGoogleLogin` |

**Common / Reference — `common.functions.ts`** → Admin → IPEN "Reference data" tab, motor/life quote wizards
`countries`, `identification-documents`, `genders`, `risk-class-categories`, `vehicle-makes`, `vehicle-models`, `motor-types`, `relationships`, `customer-vehicles`, `Policy/risk-classes/{id}`, `Policy/cover-options`, `Policy/vehicle-uses`, `Policy/products/{id}`.

**Policies — `policies.functions.ts`** → `motor-quote-wizard.tsx`, `life-quote-wizard.tsx`, `policies.$id.tsx`, `policy-live-drawer.tsx`, Admin → IPEN "Policies" tab
`Policy/generate-quotes`, `confirm-quote`, `policies`, `policy/{id}`, `life-products`, `life-product-frequencies/{id}`, `create-life-quote`, `confirm-life-quote`, `life-quote-benefits-schedule/{id}`.

**Claims — `claims.functions.ts`** → `file-claim-dialog.tsx`, Admin → IPEN "Claims" tab
`Claim/user-claims`, `Claim/claim-details/{id}`, `Claim/create-claim`.

**Payments — `payments.functions.ts`** → `policies.$id.tsx` (STK push), Admin → IPEN "M-Pesa" tab, public callbacks
`Policy/initialize-payment`, `PaymentDetails/ConfirmMpesaPayment/{proposalId}`, `PaymentDetails/InitiateMpesaExpress`, `PaymentDetails/ProcessPayment`.

**Profile — `profile.functions.ts`** → `ipen-profile-panel.tsx` (portal), Admin → IPEN "Profile" tab
`GET/PUT /api/Profile/profile`, `POST /api/Profile/upload-profile-photo`.

**Portal — `portal.functions.ts`** → `portal-dashboard-widget.tsx`, Admin → IPEN "Portal" tab
`GET /api/Portal/dashboard`.

**Documents — `documents.functions.ts`** → `document-link.tsx`, policy drawer
`GET /api/Documents/content/{key}`.

**OCR — `ocr.functions.ts`** → `ocr-button.tsx`, Admin → IPEN "OCR" tab
`POST /api/Ocr/extract-data` (multipart).

**Assistant — `assistant.functions.ts`** → `/assistant` route, Admin → IPEN "Assistant" tab
`POST /api/Assistant/chat`.

**Health** → Admin → IPEN status pill
`GET /health` via `ipenPublic`.

### 2. Inbound public webhooks (external → us) — `src/routes/api/public/`
| Route | Caller |
|---|---|
| `POST /api/public/ipen/mpesa-callback` | Safaricom M-Pesa STK result |
| `POST /api/public/ipen/process-express-callback` | IPEN Process-Payment callback |
| `POST /api/public/hooks/renewal-reminders` | Cron (renewal emails) |

### 3. KRA GavaConnect — `src/lib/kra.functions.ts` → `clients.kra-checker.tsx`, `client-form-dialog.tsx`
`POST /oauth2/token`, `POST /checker/v1/pin-by-id` → `checkPinByIdNumber`; result persisted via `savePinVerification`.

### 4. Lovable AI Gateway — `src/lib/ai-gateway.server.ts` → `/api/chat` route → `ai-assistant.tsx`, `assistant.tsx`.

### 5. Internal (Lovable Cloud / Supabase)
Client SDK: `src/integrations/supabase/client.ts` (browser + server-fn context). Server-role: `client.server.ts`. Server functions in `src/lib/*.functions.ts` (clients, policies, claims, invoices, vehicles, dashboard, reports, sessions, tenants, platform, portal, service-requests, admin-users, kyc, kra).

### Data flow (one line)
UI component → `useServerFn(fn)` → `createServerFn` in `src/lib/**` → either Supabase (RLS-scoped) or `ipenFetch`/`ipenPublic` (agency token) → external API. Callbacks arrive at `src/routes/api/public/**` and write back to Supabase.
