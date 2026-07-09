## What is causing the 502

The 502 is coming from the external AfricaBima/IPEN sandbox API, not from your app database. The flow is:

```text
Your app UI
  -> IPEN server function
  -> src/lib/ipen/ipen-fetch.server.ts
  -> IPEN_API_BASE_URL + endpoint, e.g. /api/Common/countries
  -> IPEN sandbox returns HTTP 502
```

Right now, some IPEN endpoints still treat upstream 502s as hard failures. That can block the screen or make users think the app integration is broken. The app should instead show “IPEN is temporarily unavailable” while keeping the rest of the workflow usable.

## Plan

1. **Make IPEN connection agency-wide**
   - Add an agency-level IPEN credentials store.
   - When an admin/manager connects IPEN once, the connection belongs to that agency.
   - Agents, managers, and admins in the same agency will automatically use that shared connection.
   - New agent accounts created later will immediately access IPEN services without creating their own connection.
   - Keep personal/per-user credentials only as fallback/migration support where needed.

2. **Secure the shared connection**
   - Do not expose IPEN tokens to the browser.
   - Only backend/server functions will read and use the shared token.
   - Admins/managers can connect, reconnect, verify OTP, and disconnect.
   - Agents can use IPEN services but cannot see or manage the stored credentials.

3. **Update all IPEN API wrappers to use the shared agency connection**
   - Common/reference data
   - Quotes and policies
   - Claims
   - Payments / M-Pesa
   - Documents
   - OCR
   - Profile / portal dashboard
   - Assistant chat
   - Health/status checks

4. **Handle 502 and IPEN downtime properly across every endpoint**
   - Standardize IPEN error handling in one place.
   - Reference data returns empty lists plus an inline warning instead of crashing.
   - Action endpoints like quote generation, claim filing, and M-Pesa payments show a clear retry message.
   - Add token refresh fallback when the shared token expires.
   - Preserve OTP/MFA state so users can retry after IPEN recovers.

5. **Update the IPEN admin page**
   - Show “Agency connected” status instead of “your personal connection.”
   - Show which email connected the agency IPEN account.
   - Let admins/managers connect/reconnect/verify OTP.
   - Let agents see service status and reference data but not manage credentials.

6. **Verify frontend access points**
   - Confirm IPEN reference data loads in Admin → IPEN.
   - Confirm motor quote, life quote, policy payment, claim filing, documents, OCR, portal panel, and assistant all call the shared connection.
   - Add graceful empty/error states where IPEN returns 502 or no data.

## Technical changes

- Add a new agency-level credentials table with secure access rules.
- Update `ipen-fetch.server.ts` so credential lookup checks the current user’s agency and uses the shared agency token.
- Update `auth.functions.ts` so connect/register/OTP verification writes to the shared agency connection.
- Keep the existing per-user credential table compatible so current connected accounts can be migrated or used during transition.
- Review each IPEN server function and remove any remaining hard crashes from upstream 502 responses where the UI can recover.