## Goal

Let admins and managers view (and reset) the portal login for any client that already has one — directly from the client detail page.

## UX

On `src/routes/_authenticated/clients.$id.tsx`, when `client.auth_user_id` exists, replace the current "no portal button" state with a **"View portal login"** button (visible to admin + manager). Clicking opens a dialog showing:

- Login identifier: the client's `phone` (preferred) or `email`, with a copy button
- Portal URL with copy button
- A **"Reset password"** button that generates a new temporary password, shows it once (reusing existing `CredentialsDialog` reveal UI), and invalidates the old one
- "Copy all" button (same format as generation flow)

No stored/retrievable password — matches Supabase auth's hashed-only model.

## Backend

New server function in `src/lib/admin-users.functions.ts`:

- `getClientPortalInfo({ client_id })` — admin/manager only. Returns `{ email, phone, has_login: boolean }` derived from `clients.auth_user_id` + auth user lookup. No password.
- `resetClientPortalPassword({ client_id })` — admin/manager only. Verifies the client has an `auth_user_id` and role `client`, generates a new password via existing `generatePassword`, calls `supabaseAdmin.auth.admin.updateUserById(uid, { password })`, writes an `audit_log` entry (`client.portal_password_reset`), and returns `{ email, phone, password }` shaped like `PortalCreds` so the existing `CredentialsDialog` renders it.

Both reuse `assertAdminOrManager`.

## Frontend

`src/routes/_authenticated/clients.$id.tsx`:

- Add a "View portal login" button next to "Generate portal login" (mutually exclusive based on `client.auth_user_id`).
- New small `PortalLoginDialog` (inline or new file `src/components/clients/portal-login-dialog.tsx`) that fetches `getClientPortalInfo` and shows identifier + reset button. On reset confirm, calls `resetClientPortalPassword` and pipes result into the existing `CredentialsDialog` to reveal the new password.
- Confirm prompt before reset: "This will invalidate the client's current password."

No changes to generation flow or `client-form-dialog.tsx`.

## Files

- `src/lib/admin-users.functions.ts` — add two server functions
- `src/routes/_authenticated/clients.$id.tsx` — new button + dialog wiring
- `src/components/clients/portal-login-dialog.tsx` — new component
