## 1. Importer: fix dropped vehicles like "JOSHUA KARISA / KCF 604S"

Confirmed in DB: client `Joshua Karisa` exists, but vehicle `KCF 604S` is missing. The importer silently skips a vehicle row when it can't match the client (`if (!clientId) { skippedVeh++; continue; }`). Name matching today is exact case-insensitive only, so any whitespace/punctuation/word-order difference between the sheet's NAME column and the existing client's `full_name` causes the vehicle to be orphaned. There is also no log of which rows were skipped.

### Importer fixes (`src/routes/_authenticated/admin.import.tsx`)
- Add a name-key normalizer (uppercase, collapse spaces, strip punctuation, sort words) and build a `byNormName` map alongside `byName`/`byPin`. Use it as the second-chance lookup before giving up.
- Also try matching by phone (`normPhone`) and email (`normEmail`) when name lookup fails.
- When a vehicle row is skipped, push a detailed line into the `log` state (row #, reg, name, reason) so the admin sees exactly what didn't land.
- After client inserts, rebuild the lookup maps from the newly inserted rows (already done) plus the normalized map.

### Backfill across all imports
Add a "Re-link orphan vehicles & re-import missing rows" button on the same Import page:
- Server function `relinkOrphanVehicles` (admin-only, in `src/lib/admin-users.functions.ts` or a new `src/lib/import.functions.ts`) that:
  1. Loads all vehicles with `client_id IS NULL` (none today — kept for safety) and any vehicle whose client linkage looks suspect (skip if covered).
  2. More importantly: re-scans the most recent uploaded sheet stored in component state by re-running the same import pass — but since the sheet only lives in memory, the practical backfill is: after the user re-uploads the same file, the new fuzzy matcher will pick up `JOSHUA KARISA` → existing `Joshua Karisa` and create `KCF 604S` without duplicating clients (existing pin/name match still wins).
- Document in the on-screen help text that the recommended backfill is: re-upload the same sheet — duplicates are skipped, and the new fuzzy matcher will now create the previously-missed vehicles/policies.

For the specific reported record, after the fix is deployed I'll also run a one-off insert via the data-change tool to create `KCF 604S` linked to client `612b362f-026d-4084-8e34-3fed412283a4` (Joshua Karisa) with the usage type the admin specifies on re-upload — or simply ask the admin to re-upload the sheet.

## 2. Revenue = sum of active-policy premiums

Replace the payments-derived revenue everywhere with `SUM(premium_gross)` over policies where `status = 'active'`, respecting branch scoping (admin sees all branches; manager sees their branch only).

### Server changes
- `src/lib/dashboard.functions.ts` (`getDashboardSummary`):
  - Compute `revenue` = sum of `premium_gross` from the already-fetched `policies` where `status === 'active'`.
  - Compute `revenueThisMonth` = same sum filtered by policies whose `start_date` falls in the current month (so the "this month" sub-line stays meaningful).
  - Drop the payments query (or keep it unused — prefer removing for clarity).
  - `byBranch.revenue` becomes sum of active-policy `premium_gross` per branch instead of payments.
- `src/lib/reports.functions.ts` (`getReportsSummary`):
  - `kpis.revenue` = sum of `premium_gross` for active policies in range (policies whose `start_date` overlaps `[from, to]`).
  - `revenueOverTime` bucketed by policy `start_date` month using `premium_gross` of active policies.
  - Branch performance `premium` column already uses `premium_gross` — leave as-is.

### UI
- Dashboard "Total revenue" card label stays the same; sub-line reads "X active covers" instead of "this month" (optional polish — kept simple: still show "Active cover premium this month").
- Reports page: KPI tile label changes from "Revenue" to "Active cover premium". CSV header updated to match.

## Technical notes
- All branch scoping logic is preserved (admin sees all, manager scoped to `user_branch(uid)`).
- No schema changes required.
- No new tables, no new RLS.
