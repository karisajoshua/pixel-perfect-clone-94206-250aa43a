## Surface the real IPEN validation errors + retry with PascalCase field names

"One or more validation errors occurred" is the generic ASP.NET `ValidationProblemDetails` title. The real per-field messages live in `errors: { FieldName: ["..."] }` on the response, and our current `ipenPublic` helper only reads `message` / `title` / `error` — so we throw away the useful part. Two small fixes:

### 1. `src/lib/ipen/ipen-fetch.server.ts` — flatten `errors` into the thrown message

In `rawFetch`, when the response is not ok and `data.errors` is an object, join it into the error string:

```
Registration failed: PhoneNumber: The PhoneNumber field is required.; Password: Passwords must have at least one non alphanumeric character.
```

Fallback to the existing `message` / `title` / `error` when `errors` is absent. This benefits every IPEN call, not just registration.

### 2. `src/lib/ipen/auth.functions.ts` — send both casings in the Register body

ASP.NET model binding is case-insensitive by default but some Africa Bima endpoints have shown to require PascalCase. To be safe, include both keys in the request body (e.g. `email` + `Email`, `firstName` + `FirstName`, `phoneNumber` + `PhoneNumber`, `confirmPassword` + `ConfirmPassword`). Duplicate keys cost nothing; the server keeps whichever it recognises.

No UI changes — the existing toast will now show the specific fields that failed, and we can iterate from there.

### Files touched

- Edit: `src/lib/ipen/ipen-fetch.server.ts` — richer error extraction.
- Edit: `src/lib/ipen/auth.functions.ts` — dual-case Register payload.
