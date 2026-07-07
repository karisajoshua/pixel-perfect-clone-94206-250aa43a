## Plan to fix the IPEN reconnect 502

1. **Stop treating IPEN 502 as an app crash**
   - Update the IPEN HTTP client/error handling so upstream 5xx responses are returned as clear user-facing errors instead of a generic `code: 502`.
   - Preserve the real IPEN response body in server logs for debugging, without exposing tokens to the UI.

2. **Correct the MFA verification payload**
   - Change `verifyIpenMfa` to try the DTO shape indicated by IPEN’s own login message: `/api/Auth/login/verify-mfa`.
   - Send the MFA token and OTP in a small set of likely exact field combinations instead of one oversized payload containing many aliases, because ASP.NET APIs can reject unexpected/conflicting fields.

3. **Handle expired/replaced MFA challenges cleanly**
   - If the saved challenge is expired or invalid, clear the pending MFA state and return a message telling the user to reconnect and use the newest OTP.
   - On reconnect, overwrite any previous pending token so the OTP screen always uses the latest challenge.

4. **Improve reconnect flow feedback**
   - Make reconnect/login success explicitly show that a new OTP was sent and that the previous OTP is no longer valid.
   - Keep the existing UI and database shape; only adjust the IPEN auth flow.

5. **Verify after implementation**
   - Check server logs for the exact `verify-mfa` result.
   - Confirm reconnect no longer fails with a raw 502 and instead either completes or shows a specific recoverable IPEN error.