
## Problem

`/admin/ipen` hits the root error boundary ("This page didn't load / Something went wrong on our end"). The current boundary hides the actual error message and stack, so we can't tell whether the crash is coming from the recent `auth.functions.ts` / `ipen-fetch.server.ts` edits, from `ipenStatus`, or from a component render. Typecheck passes and the dev server has no errors, so it's a runtime throw happening only for the authenticated user.

## Plan

1. **Give `/admin/ipen` its own error boundary** in `src/routes/_authenticated/admin.ipen.tsx` via `errorComponent`, so a failure inside the page doesn't blank the whole app — the sidebar/shell stays, and the panel shows the error inline with a Retry button.

2. **Show the real error details in dev/preview** in `src/routes/__root.tsx` `ErrorComponent`: keep the friendly copy in production, but when running on `*.lovableproject.com` / `localhost` / `*-dev.lovable.app`, also render `error.message` and `error.stack` in a `<details>` block so the user can screenshot and share it. Production users still see the polished fallback.

3. **Harden the IPEN status query** in `admin.ipen.tsx`: add `retry: false` on the `ipenStatus` `useQuery` (matches the reference-explorer queries) and render the status error inline instead of letting an unhandled promise rejection or render throw escape. This is the most likely culprit if the recent `ipenFetch` / auth edits changed the shape of what `ipenStatus` returns for a disconnected user.

4. **After the changes ship, the user reopens `/admin/ipen`** and either the page loads, or the inline error box shows the actual message — we then know exactly what to fix.

No backend, schema, or business-logic changes.

## Files touched

- `src/routes/_authenticated/admin.ipen.tsx` — add `errorComponent`, `retry: false` on status query.
- `src/routes/__root.tsx` — dev-only error details block inside `ErrorComponent`.
