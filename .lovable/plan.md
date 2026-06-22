## Goal

1. Let clients sign in with **either email or phone number** (both with password).
2. On the staff "Generate portal login" button: prefer **phone** when present; if neither phone nor email exists, prompt for a phone number inline before generating.

## Phone normalization

Kenyan numbers normalize to E.164 on save/login:
- `07XXXXXXXX` → `+2547XXXXXXXX`
- `7XXXXXXXX` → `+2547XXXXXXXX`
- `2547XXXXXXXX` → `+2547XXXXXXXX`
- Anything already starting with `+` is left alone.

Helper added at `src/lib/phone.ts` and reused everywhere (sign-in, client form, server fn).

## Changes

### 1. Sign-in form (`src/routes/index.tsx`)
- Replace the "Email" field on the Sign in tab with a single **"Email or phone"** field.
- On submit:
  - If the value contains `@`, call `signInWithPassword({ email, password })` as today.
  - Otherwise, normalize via `phone.ts` and call `signInWithPassword({ phone, password })`.
- Sign-up tab stays email-only (staff create accounts there).

### 2. Portal account creation (`src/lib/admin-users.functions.ts`)
Update `createClientPortalAccount`:
- Accept optional `phone` in input (used when staff supplies a new number from the UI).
- Pull `phone` from the client record; if missing and input has one, persist it to `clients.phone` first.
- Branch:
  - **Phone available** → `supabaseAdmin.auth.admin.createUser({ phone: normalized, password, phone_confirm: true })`. Returned credentials show **phone** as the login identifier.
  - **No phone but email available** → existing email flow (unchanged).
  - **Neither** → throw, UI handles the prompt.
- Linking existing auth user: also look up by phone (`listUsers` filter), not just email.
- `handle_new_user` trigger already links by email; we additionally call `update clients set auth_user_id` explicitly (already done), so phone-only accounts link correctly.

### 3. Client detail page (`src/routes/_authenticated/clients.$id.tsx`)
Replace the current "no email → toast error" behaviour:
- Button always visible while `!client.auth_user_id`.
- onClick logic:
  - If `client.phone` exists → call `createClientPortalAccount({ client_id })` directly.
  - Else if `client.email` exists → call as today (email path).
  - Else → open a small **"Add phone number"** dialog with one input + Save. On save: normalize, call `createClientPortalAccount({ client_id, phone })`.
- `CredentialsDialog` already exists; extend it to display "Phone" instead of "Email" when the response identifier is a phone number.

### 4. Client form dialog (`src/components/clients/client-form-dialog.tsx`)
- On save, normalize the phone field through `phone.ts` before insert/update.
- After auto-creating the portal login for new clients, the credentials dialog will show phone-based creds when phone is provided (no extra wiring needed beyond the response shape change in step 2).

### 5. No database migration
Auth `phone` column is built-in; `clients.phone` already exists. No schema changes.

## Files touched
- `src/lib/phone.ts` *(new)*
- `src/routes/index.tsx`
- `src/lib/admin-users.functions.ts`
- `src/routes/_authenticated/clients.$id.tsx`
- `src/components/clients/client-form-dialog.tsx`

## Out of scope
- SMS OTP / passwordless login (not requested; would require Twilio).
- Changing the staff sign-up tab to accept phone (staff use email).
