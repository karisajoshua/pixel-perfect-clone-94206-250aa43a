## 1. Vehicle ownership transfer

**UI** (`src/routes/_authenticated/vehicles.tsx` + new `TransferOwnershipDialog`):
- Add a "Transfer" action (row action + on vehicle edit dialog) visible to admin/manager only.
- Dialog shows current owner, a searchable client typeahead (same pattern as vehicle form), and an optional "Reason / notes" field.
- On confirm: update `vehicles.client_id` to new client (branch_id also updated to new client's branch if set). Append a note line like `Transferred from <old> to <new> on <date>: <reason>` into `vehicles.notes`.
- Audit log entry via existing `audit_log` table (insert action `vehicle.transfer`).

**Backend** — new server fn `transferVehicleOwnership` in `src/lib/vehicles.functions.ts` using `requireSupabaseAuth`, restricted to admin/manager via `has_role`. Does the update + audit insert.

Note: existing policies keep their original `client_id` (historical accuracy); only the vehicle record moves. This is called out in the dialog copy.

## 2. Policy cancellation with reason

**Schema migration**:
- Add `cancelled_at timestamptz`, `cancellation_reason text`, `cancelled_by uuid` to `public.policies`.
- Extend allowed `status` values to include `cancelled` (status is free text today, no CHECK — nothing to alter, just start using it).

**UI** (`src/routes/_authenticated/policies.$id.tsx`):
- Add "Cancel policy" button (admin/manager/agent, only when status is not already `cancelled`).
- Dialog: required textarea for reason, confirm button.
- Sets `status='cancelled'`, `cancelled_at=now()`, `cancellation_reason`, `cancelled_by=auth.uid()`.
- Show cancellation info block on the detail page when cancelled.

## 3. Dashboard surfacing

**Backend** (`src/lib/dashboard.functions.ts`):
- Add to `totals`: `cancelledPolicies` count and `cancelledThisMonth` count (scoped same as other metrics).
- Add `recentCancellations`: last 5 cancelled policies with `policy_no`, client name, `cancelled_at`, `cancellation_reason`.

**UI** (`src/routes/_authenticated/dashboard.tsx`):
- New tile "Cancelled policies" alongside existing tiles.
- New card "Recent cancellations" listing the 5 most recent with reason (admin/manager visible).

## Technical notes
- Migration file adds three columns to `policies`; no CHECK constraints; existing RLS covers writes.
- No changes to types file needed by hand — regenerated post-migration.
- Roles are checked both server-side (server fn) and client-side (button visibility) using existing `useMyRoles` / `has_role`.