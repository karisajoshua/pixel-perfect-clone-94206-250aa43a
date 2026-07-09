## Changes

### 1. Invoice dialog — searchable client picker
In `src/components/invoices/invoice-form-dialog.tsx`, replace the current `<Select>` client dropdown (which only loads the first page of clients) with the same server-side searchable typeahead used in the vehicle dialog: type 2+ characters → query `clients` by `full_name`/`company_name`/`email`/`phone` with `ilike`, show results in a popover, select to set `client_id`. Keeps policy dropdown filtered by chosen client.

### 2. Agents can see the full client database
Root cause: the `clients read scope` RLS policy restricts agents to `branch_id = user_branch` OR `assigned_agent = auth.uid()`, so clients from other branches / unassigned to them are invisible — that's why some searches return nothing.

Migration: drop and recreate the SELECT policy so `agent` gets the same tenant-wide read as `admin`/`manager` (still gated by the existing `tenant_isolation` policy, so cross-agency leakage is prevented). UPDATE/DELETE policies stay branch-scoped — agents can view all clients but can only edit their branch/assigned ones. Viewer role unchanged.

### 3. Converted quotes auto-appear under policies
The convert flow already inserts a policy row and invalidates the `policies` query, so the row does exist — it's just easy to miss because the new policy is created with `status: "pending"` and a placeholder `POL-<timestamp>` number, then the toast says "Update the policy number", which suggests it lives elsewhere.

Fixes in `src/routes/_authenticated/quotations.tsx` `convert()`:
- After a successful convert, navigate the user to `/policies/$id` for the new policy so they land on the record they just created (no ambiguity about where it went).
- Change the toast to "Policy created from quote — update details" with an "Open policy" action as a fallback.
- Also invalidate the `dashboard` query so counts update.

No changes to policy list filters — it already shows all statuses.

## Files
- `src/components/invoices/invoice-form-dialog.tsx` — searchable client picker
- `src/routes/_authenticated/quotations.tsx` — post-convert navigation + toast
- New migration — widen `clients` SELECT policy for `agent`
