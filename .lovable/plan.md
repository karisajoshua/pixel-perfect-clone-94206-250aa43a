## This is an upstream IPEN/Ecobank error, not a bug in this app

The error comes from the IPEN backend (`Ecobank_Api_Backend.Services.OtpService`) when it tries to generate and send a new MFA code. Their SQL Server database is missing two columns on the OTP/attempts table:

- `Purpose`
- `Attempts`

Stack trace confirms it happens in their code at `OtpService.cs:line 62`, called from `AuthService.LoginAsync` at `line 71`. Entity Framework is issuing a query that references columns that don't exist in their database — meaning IPEN deployed new application code without running the matching database migration on their side.

There is nothing we can change in our TanStack app, our request payload, or our Supabase database that will fix this. The failure is 100% on the IPEN side.

## Proposed plan

1. **Surface the upstream error clearly to the user** in `src/lib/ipen/auth.functions.ts` / `src/routes/_authenticated/admin.ipen.tsx`:
   - Detect responses whose body contains `Invalid column name` (or a generic IPEN 500 during MFA send) and show a friendly message like:
     > "Ecobank/IPEN's login service is currently failing on their side (missing database columns `Purpose` / `Attempts`). This is not something we can fix from Zest — please contact IPEN support and retry once they've patched their service."
   - Keep the raw error in server logs (redacted) for our own diagnostics.

2. **Do not clear the stored MFA token** for this error class — it's an upstream outage, not an expired challenge, so we shouldn't force the user to reconnect repeatedly.

3. **Add a lightweight "IPEN status" note** on the `/admin/ipen` connect screen when the last attempt failed with an upstream 5xx, so the user knows to wait rather than keep retrying.

4. **Action for you (outside code):** open a ticket with IPEN/Ecobank quoting the error above so they run the missing EF Core migration that adds `Purpose` and `Attempts` to their OTP table.

No changes to Supabase schema, RLS, or business logic — this is purely error-handling/UX polish around an external outage.
