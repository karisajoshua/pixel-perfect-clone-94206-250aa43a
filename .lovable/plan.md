## Simplify the IPEN OTP flow to just "enter and verify"

The user already receives the Ecobank OTP. The current UI mixes "Request OTP", "IPEN password", "Resend", and duplicated forms across tabs — it's confusing. Reduce the entire OTP step to a single, obvious box: paste the code, click Verify.

### Changes to `src/routes/_authenticated/admin.ipen.tsx`

1. **Strip the OTP UI down to one panel** shown at the top of the Connection card whenever the user is either connected OR has an MFA challenge pending (i.e. any state where verifying an OTP makes sense):
   - One input: `Ecobank OTP`
   - One button: `Verify`
   - One small helper line: `Paste the code from the Ecobank / IPEN SMS or email.`
   - A small secondary `Resend code` link (uses existing `resendFn`) — only shown when `mfa_required` is true.

2. **Remove from the page:**
   - The `IPEN password` field inside the OTP section
   - The `Request OTP` button and `doRequestOtp` function
   - The `otpPassword` state
   - The duplicated OTP forms under the Sign in / Register tabs (those tabs already trigger OTP send on submit — no extra form needed there)
   - The separate `mfaPending` branch layout; fold it into the single OTP panel

3. **Keep unchanged:** sign-in form, register form, disconnect, test connection, all server functions. No backend changes.

### Result

Whether the user just signed in, just registered, or is already "connected" but has a fresh OTP in hand, they see the same single box: **Ecobank OTP → Verify**. Nothing else to think about.
