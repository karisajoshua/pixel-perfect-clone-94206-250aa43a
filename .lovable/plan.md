## Problem

After connecting IPEN, hitting the reference-data tabs (or "Test connection") throws:

> Cannot read properties of undefined (reading 'from')

## Root cause

`src/lib/ipen/common.functions.ts` builds every list server function through a `makeListFn(key, path)` factory that internally calls `createServerFn(...).middleware([requireSupabaseAuth]).handler(...)`. Two things go wrong with that shape:

1. TanStack's server-fn Vite splitter expects `createServerFn` chains at module top level. When the chain is produced inside a factory, the middleware wiring is not preserved in the built server bundle, so `context` arrives without `supabase` / `userId`.
2. The handler also closes over module-scope helpers (`cached`, `CACHE`, `key`) — the splitter drops those references, leaving `supabase` undefined.

`ipenFetch` then calls `supabase.from("ipen_credentials")` → `undefined.from` → the exact error the user sees. The connection isn't broken; the read path is.

The other IPEN files that already work (`auth.functions.ts`, `listCustomerVehicles`, `listRiskClasses`, `listVehicleUses`, `listProducts`) all declare `createServerFn` at top level — confirming the diagnosis.

## Fix

Rewrite `src/lib/ipen/common.functions.ts` so every exported server function is declared at top level, with all logic inline in the handler.

- Remove the `makeListFn` factory.
- Move the in-memory `CACHE` map and the `cached()` helper into a new server-only module `src/lib/ipen/common-cache.server.ts` (imported by the handlers; server-only helpers are allowed as imports inside handlers).
- For each existing export (`listCountries`, `listIdentificationDocuments`, `listGenders`, `listRiskClassCategories`, `listVehicleMakes`, `listVehicleModels`, `listMotorTypes`, `listRelationships`, `listCoverOptions`), write an explicit `createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(...).handler(...)` with the path hardcoded inside the handler.
- Keep the existing `listCustomerVehicles`, `listRiskClasses`, `listVehicleUses`, `listProducts` unchanged (already correct shape).
- No changes to `auth.functions.ts`, `ipen-fetch.server.ts`, the admin UI, or the database.

## Verification

- After the edit, the admin IPEN page's "Test connection" button and each Reference-data tab should return live rows instead of the `.from` error.
- The existing MFA/connect flow is untouched.
