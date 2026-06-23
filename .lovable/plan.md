## Goal

1. Admin can assign or transfer any client to a branch.
2. Any record created by a manager (or agent) automatically falls under their own `user_branch`, with no UI for them to pick a different branch.

## 1. Admin-only branch assignment on clients

**UI — `src/routes/_authenticated/clients.$id.tsx`**
- Add a new "Branch" row to the Overview profile with the current branch name.
- Next to it, render a "Change branch" button **only when the caller has the `admin` role** (via `useMyRoles`).
- Button opens a small dialog with a `<Select>` of all branches (loaded from `branches` table). Saving calls `updateClientBranch` server fn, then invalidates the `["client", id]` query.

**UI — `src/components/clients/client-form-dialog.tsx`**
- Branch `<Select>` becomes visible **only to admins**. Managers/agents see no branch field; the server fills it in.

**Server fn — new `src/lib/clients.functions.ts`**
- `updateClientBranch({ clientId, branchId })` — `requireSupabaseAuth` + `assertAdmin`, updates `clients.branch_id`. Admin-only because RLS would otherwise block a manager from moving a client out of their own branch.

## 2. Auto-scope new records to the creator's branch

Today the client form sends `branch_id` from the form. For managers/agents we want the server to ignore that and force `user_branch(auth.uid())`.

**Database — one migration**
- `BEFORE INSERT` triggers on `clients`, `policies`, `claims`, `invoices`, `quotations`, `service_requests` that:
  - If the caller is `admin` → leave `NEW.branch_id` as supplied.
  - Otherwise → overwrite `NEW.branch_id := public.user_branch(auth.uid())` (and reject if that is `NULL`).
- This guarantees branch ownership regardless of whether the row is created from the staff UI, the AI assistant, or a future API call.
- `vehicles` inherits via its parent client, so no trigger needed.

**Client form changes**
- `client-form-dialog.tsx`, `policy-form-dialog.tsx`, `invoice-form-dialog.tsx`, `vehicles/vehicle-form-dialog.tsx`, plus `quotations.tsx` / `claims.tsx` / `service-requests` create flows: hide the Branch picker for non-admins. They can keep sending `branch_id` for admins; the trigger is the source of truth for everyone else.

## 3. Out of scope

- Bulk re-assignment of many clients at once (can be added later as an admin tool).
- Moving sub-records (policies/invoices) independently of their client — they stay with the client's branch.
- Changing the role model or the existing manager-scoped RLS from the previous turn.

## Technical notes

- Trigger uses `SECURITY DEFINER` calling `public.has_role(auth.uid(), 'admin')` and `public.user_branch(auth.uid())`, both already defined.
- `updateClientBranch` writes an `audit_log` row (`action='client.branch_changed'`) so transfers are traceable.
- `attachSupabaseAuth` is already wired globally, so the new server fn needs no extra setup.
