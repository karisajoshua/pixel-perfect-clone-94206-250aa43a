## What this will fix

The OTP from Ecobank is the IPEN/Africa Bima verification code. Their backend appears to send OTP messages under an Ecobank sender/name, so the app needs to guide you to enter that code before it treats IPEN as usable.

Right now the app can show “Connected” too early if IPEN returned a pending MFA/OTP challenge along with partial token data. That makes live quotes, reference data, policies, claims, and payments fail because the account has not finished verification.

## Plan

1. **Correct IPEN connection status**
   - Treat any `mfa_required` / `mfaToken` response as “verification pending,” not “connected.”
   - Do not store usable access tokens until the OTP has been verified.

2. **Show the OTP entry UI clearly**
   - On the Admin → IPEN page, show the verification-code form whenever IPEN verification is pending.
   - Add clear copy explaining that the Ecobank OTP is the IPEN verification code.
   - Keep the existing Verify and Resend actions.

3. **Prevent silent failures in live IPEN features**
   - If a user tries live quotes/reference data/policies/claims while OTP verification is pending, return a clear message telling them to finish verification in Admin → IPEN.
   - This avoids the current “connected but nothing works” state.

4. **Add an obvious connection test**
   - Add a “Test connection” action on the connected IPEN card that calls a lightweight IPEN lookup and shows success or the exact failure message.
   - This gives immediate confirmation that live IPEN calls are really working.

5. **Current-account recovery**
   - If your current stored IPEN connection is stuck in the wrong state, signing in again with the IPEN email/password should request a fresh OTP and move the page into the verification-code state.

## Files to update

- `src/lib/ipen/auth.functions.ts`
- `src/lib/ipen/ipen-fetch.server.ts`
- `src/routes/_authenticated/admin.ipen.tsx`
