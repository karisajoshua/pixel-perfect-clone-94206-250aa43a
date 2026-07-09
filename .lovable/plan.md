## Fix: OTP not received after IPEN Connect succeeds

**Diagnosis:** IPEN's `/api/Auth/Login` returns an `mfaToken` (challenge id) but does not always trigger the OTP delivery on the same call — some tenants require the client to explicitly hit `/api/Auth/login/resend-mfa` to actually dispatch the code. Our current code stores the `mfaToken`, shows the OTP box, and waits — so the user sees "Enter OTP" but nothing arrives.

We already have `resendIpenMfa` implemented (tries `/api/Auth/login/resend-mfa` → `/api/Auth/resend-otp` → `/api/Auth/resend-mfa`). We just need to fire it automatically after Connect returns `mfaRequired`, and surface a clearer "Send code" / "Resend code" affordance.

### Changes

1. **`src/lib/ipen/auth.functions.ts` — `connectIpen`**
   When the login response indicates MFA required, immediately call the resend endpoints (best-effort, ignore failure) so IPEN dispatches the code. Return `{ mfaRequired, otpSent: boolean, otpChannel?: "email"|"sms"|"unknown" }` (channel inferred from response payload keys when present).

2. **`src/routes/_authenticated/admin.ipen.tsx` — Connect card**
   - After a successful Connect that returns `mfaRequired`, toast: "OTP sent to your IPEN email/phone. Check your inbox and SMS."
   - In the OTP verification box, rename the existing resend button to **"Resend OTP"** and always show it (not only after a failed verify).
   - Add helper copy: "Didn't get the code? Check spam, then click Resend."

3. **No schema or RLS changes.** No new secrets.

### Out of scope
- Delivery-channel selection UI (IPEN sandbox picks the channel based on the registered contact).
- Fallback to email-only when SMS fails — that's an IPEN-side setting.

### Verification
- Click Connect on `/admin/ipen`, confirm toast says "OTP sent…" and OTP box appears with a Resend button.
- Check the IPEN-registered email/phone for the code.
- Enter the code → verify succeeds → status flips to "Agency connected".