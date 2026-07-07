## Problem

The IPEN API is returning a “connected” style response, so the app shows the `IPEN connected` toast. But you still received an Ecobank OTP, meaning IPEN still expects verification. Because the UI only opens the OTP panel when `mfaRequired` is explicitly true, the OTP box remains hidden.

## Fix

1. **Always show OTP recovery on the IPEN page**
   - Replace the hidden/toggled OTP panel with a permanently visible section on the Connection card:
     - IPEN password
     - Ecobank OTP
     - Request OTP
     - Verify OTP
   - This means you will not need to wait for a pop-up or hidden state.

2. **Open the OTP section automatically after connect/register**
   - After any IPEN sign-in or register attempt, show the OTP section even if IPEN says “connected.”
   - Change the toast to say: `IPEN sign-in submitted. If you received an Ecobank OTP, enter it below.`

3. **Make verify usable even when the app thinks it is connected**
   - Keep the `Request OTP` button to generate a fresh OTP using your IPEN email/password.
   - Keep `Verify OTP` using the stored MFA challenge.
   - If there is no stored challenge, show a clear message telling you to click `Request OTP` first.

4. **Reduce confusion around Ecobank**
   - Add helper text directly beside the OTP input: `The Ecobank code is the IPEN verification code.`

## Files to update

- `src/routes/_authenticated/admin.ipen.tsx`
- `src/lib/ipen/auth.functions.ts` only if needed to make the error message clearer when no MFA challenge exists.
