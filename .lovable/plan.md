## Why "pending challenge" fails

`verifyIpenMfa` bails with *"No pending OTP challenge"* whenever `ipen_credentials.mfa_token` is `null`. The row is `null` because IPEN's login response for your account doesn't return a field named `mfaToken` / `mfa_token` — `extractTokens` only looks for those two keys, so nothing gets stored even though Ecobank did send you an OTP.

The fix is to (a) actually see what IPEN returns so we stop guessing, (b) accept more key names, and (c) make verify still work when no challenge token is available.

## Changes

All in `src/lib/ipen/`. No UI changes, no schema changes.

### 1. `ipen-fetch.server.ts` — widen `extractTokens`
Look for the challenge token under any of these keys (first non-empty wins):
`mfaToken`, `mfa_token`, `twoFactorToken`, `otpToken`, `challengeToken`, `challengeId`, `mfaSessionId`, `sessionId`, `verificationToken`, `requestId`.

Also treat `mfaRequired` as true when the payload has `requiresTwoFactor`, `requires_mfa`, `twoFactorRequired`, or a `message` containing "otp"/"verification"/"two-factor" and no `accessToken`.

### 2. `auth.functions.ts` — log + tolerant verify

**`connectIpen` / `registerIpen`:** after the IPEN call, `console.log("[ipen] login response keys", Object.keys(res.data ?? {}), res.data)` so the next preview run reveals the real field name. (Server log only, no PII beyond what we already send.)

**`verifyIpenMfa`:** stop throwing when `mfa_token` is null. Instead:
1. Load the row's `ipen_email` too.
2. Try `/api/Auth/login/verify-mfa` with whichever of these bodies has data:
   - `{ mfaToken, code }` if we have one
   - else `{ email, code }` as fallback
3. If that returns 404/400, retry against `/api/Auth/verify-mfa` and `/api/Auth/verify-otp` with the same body. First 2xx wins.
4. On failure, surface the actual IPEN error message (already returned by `ipenPublic`) instead of the generic "pending challenge" text.

**`resendIpenMfa`:** same tolerant fallback — if no `mfa_token`, send `{ email }` to `/api/Auth/login/resend-mfa`, then `/api/Auth/resend-otp` as fallback.

### 3. Nothing else
Keep `admin.ipen.tsx`, the `OtpBox`, and the DB schema exactly as they are. Once the console log shows which key IPEN actually uses, if it isn't already in the list above we add it in a follow-up one-liner.

## Result

- You enter the OTP → Verify hits IPEN with either the real challenge token (if we now recognize it) or `{ email, code }` as a fallback → tokens get stored → connection completes.
- If IPEN itself rejects the code, you see IPEN's own error text (e.g. "Invalid code", "Expired") instead of our misleading "No pending challenge".
