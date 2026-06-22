## Problem

Portal logins are created with a phone number (via `createClientPortalAccount`), but Supabase Auth has the **Phone provider disabled**, so clients can't sign in with the phone + temporary password we hand them. The error "phone logins are disabled" comes straight from Auth.

## Fix

Enable the Phone provider in Lovable Cloud auth settings so phone + password sign-in works for client portal accounts.

Two options — pick one:

### Option A — Enable Phone auth (recommended, matches current code)

You enable it from **Cloud → Users → Auth Settings → Phone provider → toggle on**. No SMS provider is needed because we set `phone_confirm: true` server-side (no OTP is sent); clients sign in with phone + the temporary password shown in the "Client portal login" dialog.

No code changes required. After enabling, existing generated credentials will work immediately.

### Option B — Switch portal logins to email-only

Change `createClientPortalAccount` to always create the auth user with `email` (never `phone`), and require an email on the client before generating a login. The "Generate portal login" button would be disabled until an email exists, and the phone-prompt dialog on the client detail page would become an email-prompt dialog.

This avoids enabling the Phone provider but means clients without an email on file can't get a portal login until you add one.

## Recommendation

Go with **Option A**. Your existing flow (phone-first, email fallback) and the credentials dialog already assume phone login works. Enabling the provider is a one-toggle change with zero code edits.

Confirm A and I'll guide you through the toggle (it's a setting only you can flip — agents can't change provider toggles for you).
