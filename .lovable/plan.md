## Fix claim edit save error

**Root cause:** In `src/routes/_authenticated/claims.tsx`, when editing a claim, `form` is initialized from `initial`, which comes from a query that joins `clients`, `policies`, and `vehicles`. On save, the whole `form` is spread into the update payload, sending those joined relation objects (and other non-column fields) to PostgREST, which rejects the update.

**Fix (single file: `src/routes/_authenticated/claims.tsx`):**

In `submit()`, build the update/insert payload from a whitelist (or explicit exclusion) instead of `...form`. Strip:
- Joined relations: `clients`, `policies`, `vehicles`
- Server-managed fields on update: `id`, `created_at`, `updated_at`, `tenant_id`, `branch_id`, `ipen_claim_id`, `created_by` (keep only on insert)

Simplest implementation: destructure those keys out of `form` before spreading, e.g.

```ts
const { clients, policies: _p, vehicles: _v, id, created_at, updated_at, tenant_id, branch_id, ...rest } = form;
const payload: any = { ...rest, third_party_details: thirdParties };
if (!initial?.id) payload.created_by = u.user?.id;
```

No schema, server-function, or other UI changes.
