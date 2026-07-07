## KRA PIN checker (lookup PIN by ID number)

The endpoint you linked (GavaConnect DTD_PINChecker) is KRA's official Enterprise API. It uses OAuth2 client-credentials — you register an app on `developer.go.ke`, receive a **client ID + client secret**, then call the PIN-by-ID endpoint with a bearer token. Same shape used by every wrapper (Salami Gateway, gavaconnect-sdk, kra-php-sdk).

I'll wire it up end-to-end and let you paste the credentials in at the end.

## 1. Secrets (I'll request via secrets tool)

- `KRA_GAVACONNECT_CLIENT_ID`
- `KRA_GAVACONNECT_CLIENT_SECRET`
- `KRA_GAVACONNECT_BASE_URL` (default `https://api.gavaconnect.go.ke`, overridable if KRA gave you a sandbox URL)

## 2. Schema — one migration

Add to `public.clients`:

- `kra_id_type text` (`national_id` | `passport` | `service_id` | `alien_id`) — remembers what we verified against
- `kra_verified_name text` — taxpayer name returned by KRA
- `kra_verified_at timestamptz` — verification timestamp
- `kra_verification_status text` — `verified` | `mismatch` | `not_found` | `error`

No policy changes — inherits existing clients policies.

## 3. Server function — `src/lib/kra.functions.ts`

`checkPinByIdNumber` (createServerFn, requireSupabaseAuth):
- Input: `{ id_number: string, id_type: 'national_id'|'passport'|'service_id'|'alien_id' }`
- Fetch (and cache in module-scope for ~50 min) OAuth2 token via `POST {BASE_URL}/oauth2/token` with `grant_type=client_credentials`
- Call `POST {BASE_URL}/checker/v1/pin-by-id` with `{ TaxpayerID, TaxpayerType }` (codes 1/2/3/4)
- Normalise response to `{ pin, taxpayer_name, status, raw }`
- Errors surface as `{ ok:false, code, message }` (never leak credentials)

`savePinVerification` (admin/manager/agent role):
- Input: `{ clientId, id_type, pin, taxpayer_name, status }`
- Writes `kra_pin`, `kra_id_type`, `kra_verified_name`, `kra_verified_at=now()`, `kra_verification_status`
- Writes `audit_log` row `client.kra_verified`

## 4. UI

### a) Inline in the client form (`src/components/clients/client-form-dialog.tsx`)

- Small **ID type** Select next to the existing `id_number` field (defaults to National ID).
- **"Check KRA PIN"** button — disabled until an ID number is entered.
- On success: auto-fill `kra_pin`, show a green pill `Verified — <TAXPAYER NAME>` under the PIN field.
- On mismatch (user typed a PIN that doesn't match the one returned): show amber "PIN mismatch — expected `A123456789Z`" with an **Apply KRA PIN** button.
- On not-found / error: red inline hint with the KRA message.
- Verification is persisted on Save (part of the existing insert/update payload).

### b) Standalone page — `/clients/kra-checker`

- New route `src/routes/_authenticated/clients.kra-checker.tsx` (role: admin/manager/agent).
- ID type + ID number inputs → **Check** button → result card with KRA PIN, taxpayer name, status.
- If the ID matches an existing client (`clients.id_number = ?`), show that client with an **"Update client"** button that calls `savePinVerification`.
- If not, show **"Create new client with this PIN"** button that opens `ClientFormDialog` pre-filled.
- Recent lookups list (last 20) from a lightweight in-memory query cache — no new table.

### c) Navigation

- Add "KRA PIN checker" link under the Clients group in `src/components/app-shell.tsx`.

## 5. Files touched

- New: `src/lib/kra.functions.ts`
- New: `src/routes/_authenticated/clients.kra-checker.tsx`
- Edit: `src/components/clients/client-form-dialog.tsx`
- Edit: `src/components/app-shell.tsx`
- New migration: add KRA verification columns to `public.clients`
- Secrets: request `KRA_GAVACONNECT_CLIENT_ID`, `KRA_GAVACONNECT_CLIENT_SECRET`, `KRA_GAVACONNECT_BASE_URL`

## Assumptions to confirm (build proceeds with these unless you say otherwise)

- Endpoint path is `POST /checker/v1/pin-by-id`; if KRA gave you a different path when you registered the app I'll swap it in one line.
- Token endpoint is `POST /oauth2/token` (client-credentials, Basic auth header).
- Only admin/manager/agent can run the lookup; portal (`client`) role cannot.
