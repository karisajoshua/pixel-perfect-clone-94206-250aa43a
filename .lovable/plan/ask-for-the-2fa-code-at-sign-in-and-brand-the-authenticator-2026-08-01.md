# Ask for the 2FA code at sign-in, and brand the authenticator entry

Two separate problems, both confirmed in the code.

## 1. Sign-in never asks for the code

Today the login screen calls password sign-in and immediately routes you to the dashboard. Two-factor is enrolled on your account, but nothing ever asks for the 6-digit code, so the second factor is effectively decorative — the session stays at the "password only" assurance level.

Fix:
- After a successful password sign-in, check whether the account has a verified authenticator and whether the current session has already been stepped up.
- If a code is required, keep the user on the sign-in screen and show a "Enter your 6-digit code" step (with the existing OTP input styling) instead of navigating.
- On a correct code, continue to the normal role-based redirect (portal / onboarding / dashboard). On a wrong code, show an error and let them retry.
- Add the same check to the protected area gate so an un-stepped-up session cannot reach app pages by navigating directly; it bounces back to the sign-in screen's code step.
- Also cover password-reset return and any other place that lands a fresh session.

## 2. The authenticator app shows Lovable details instead of your agency

The QR code is generated straight from the enrolment URI, whose issuer/label come from the backend project settings — that's why Google Authenticator lists platform details rather than your agency and your email.

Fix:
- Rewrite the enrolment URI before rendering the QR: set the issuer to the signed-in user's agency name (falling back to "Zest Insurance Agency") and the account label to the user's email, keeping the secret and all other parameters untouched.
- Show the same friendly name next to the manual setup key so it matches what appears in the app.
- Name the enrolled factor after the agency so the security page lists it clearly.

Note: entries already added to Google Authenticator keep their old name — they will need to be removed and re-scanned once. The security page will say so.

## Technical notes

- `src/routes/index.tsx`: after `signInWithPassword`, call `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`; when `nextLevel === 'aal2'` and `currentLevel !== 'aal2'`, render a challenge step that calls `mfa.challenge` + `mfa.verify` on the verified TOTP factor before the existing redirect logic runs. Same guard in the already-signed-in `useEffect`.
- `src/routes/_authenticated/route.tsx`: extend the existing gate to redirect to `/` when the assurance level is short of `aal2`.
- `src/routes/_authenticated/admin.security.tsx`: parse `data.totp.uri`, replace the label and `issuer` query param using the tenant brand name, and pass `friendlyName` on `mfa.enroll`.
