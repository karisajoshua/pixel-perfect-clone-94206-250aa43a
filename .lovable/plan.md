## Add "Register" to the IPEN connection screen

Right now `Admin → IPEN` only lets a user log in with existing IPEN credentials. Africa Bima's docs require calling the **Register** endpoint first to create the account, so I'll add that flow next to the existing login card — no schema or navigation changes needed.

### 1. Server function — `src/lib/ipen/auth.functions.ts`

New `registerIpen` (createServerFn, requireSupabaseAuth):
- Input (Zod): `email`, `password`, `confirmPassword`, `firstName`, `lastName`, `phoneNumber`, optional `middleName`, `idNumber`, `companyName`.
- Calls `POST {IPEN_API_BASE_URL}/api/Auth/Register` via the existing `ipenPublic` helper (no bearer, JSON body — snake_case + camelCase tolerated by our `extractTokens`).
- On success:
  - If the response returns tokens → persist to `ipen_credentials` the same way `connectIpen` does and return `{ registered: true, connected: true, mfaRequired: false }`.
  - If the response returns an `mfaToken` (email verification) → persist `mfa_token` + `ipen_email` and return `{ registered: true, mfaRequired: true }` so the existing MFA UI takes over.
  - If neither → return `{ registered: true, connected: false, mfaRequired: false, message: "Check your email to verify, then sign in below." }`.
- Errors bubble up the IPEN error message verbatim (never leak our secrets).

### 2. UI — `src/routes/_authenticated/admin.ipen.tsx`

Wrap the current connection card body in a two-tab switch **Sign in / Register** (shadcn `Tabs`), only visible when not already connected and not mid-MFA.

Register tab fields (all required unless noted):
- First name, Last name, Middle name (optional)
- Email, Phone number
- ID number (optional), Company (optional)
- Password, Confirm password (client-side match check)
- **Create IPEN account** button → `registerIpen` → reuses `refresh()` + the existing MFA panel when `mfaRequired` comes back; otherwise toasts success and either shows "Connected" or drops the user into the Sign in tab with the email pre-filled.

No changes to the reference-data explorer or any other IPEN pages.

### 3. Files touched

- Edit: `src/lib/ipen/auth.functions.ts` — add `registerIpen`.
- Edit: `src/routes/_authenticated/admin.ipen.tsx` — Sign in / Register tabs + form.

### Assumption to confirm

The Register endpoint path is `POST /api/Auth/Register` (matches the `/api/Auth/Login`, `/api/Auth/refresh-token`, `/api/Auth/logout` paths already wired). If your docs use a different path or a different field name (e.g. `PhoneNumber` vs `phone_number`), tell me and I'll adjust the payload in one spot.
