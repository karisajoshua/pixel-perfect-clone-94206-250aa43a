## 1. Admin can delete clients

DB already allows it (`clients delete admin` policy). Missing pieces are UI + safety.

**UI** — add a red "Delete client" button on the client detail page (`src/routes/_authenticated/clients.$id.tsx`), visible only when the current user has the `admin` role. Confirm via an AlertDialog that spells out what will happen. Also add a small Trash button on each row of the clients list (`src/routes/_authenticated/clients.tsx`), admin-only.

**Safety** — some related tables cascade on client delete (vehicles, quotations, service requests, client documents/communications), others RESTRICT (policies, invoices, claims). So a raw delete can either silently wipe history or fail with a FK error.

Add a server function `deleteClient({ id, force? })` in `src/lib/clients.functions.ts` that:
- Verifies the caller is admin.
- Counts dependents in `policies`, `invoices`, `claims`, `vehicles`, `quotations`.
- If any RESTRICT-side dependents (policies / invoices / claims) exist → refuse with a clear message ("Client has N policies, N invoices, N claims — archive instead of delete").
- Otherwise delete the row (cascades handle the rest) and write an `audit_log` entry.

The confirm dialog surfaces the dependent counts before the user commits.

## 2. Unique ID number and KRA PIN

Migration on `public.clients`:
- Normalize existing values (trim, uppercase KRA PIN, empty string → NULL) via a one-off `UPDATE`.
- Add partial unique indexes scoped per tenant so different agencies can independently hold the same national ID:
  - `unique (tenant_id, upper(id_number)) where id_number is not null and id_number <> ''`
  - `unique (tenant_id, upper(kra_pin)) where kra_pin is not null and kra_pin <> ''`

Client form (`src/components/clients/client-form-dialog.tsx`) — catch Postgres unique-violation (`code === '23505'`) on save and show a friendly toast: "An existing client already has this ID number / KRA PIN." Same handling on the KRA checker's "Save PIN to client" action.

If any duplicate rows already exist in the DB the unique index creation will fail; the migration first surfaces duplicates via a SELECT so we know before enforcing. If duplicates come back, I'll pause and ask which row to keep before enforcing the constraint.

## Files
- New migration — unique indexes on `(tenant_id, id_number)` and `(tenant_id, kra_pin)`
- `src/lib/clients.functions.ts` — `deleteClient` server function
- `src/routes/_authenticated/clients.$id.tsx` — Delete button + confirm dialog
- `src/routes/_authenticated/clients.tsx` — row delete action
- `src/components/clients/client-form-dialog.tsx` — unique-violation toast
