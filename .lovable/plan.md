## Goal
Show the agency's earnings on the main dashboard — a total revenue figure plus a breakdown per branch.

## What you'll see
- A new **Total revenue** KPI tile alongside the existing Clients / Policies / Claims / Renewals tiles, with a small "this month" sub-figure.
- A new **Revenue by branch** card listing every branch with its revenue total, share of the company total, and policy count, sorted by revenue desc. Includes an "All branches" total row.
- Numbers respect role-based access: admins/managers see all branches; branch-scoped staff see only their branch (RLS already enforces this — no extra gating needed).
- Client-portal users keep being redirected away from `/dashboard` to `/portal` (existing behavior preserved).

## Data source
Revenue = sum of `payments.amount` (money actually received), matching the convention already used in `src/lib/reports.functions.ts`. Per-branch attribution comes via `payments → invoices.branch_id`.

## Implementation

1. **New server function** `getDashboardRevenue` in `src/lib/dashboard.functions.ts`:
   - Uses `requireSupabaseAuth` (RLS scopes results automatically).
   - Queries `payments` joined to `invoices(branch_id)` for all-time and current-month windows, plus `branches(id, name)` for labels.
   - Returns `{ total, totalThisMonth, byBranch: [{ branchId, branchName, revenue, share, policies }] }`.
   - Also returns counts for active policies / open claims / due renewals so the existing tiles can show real numbers instead of `—`.

2. **Dashboard route** `src/routes/_authenticated/dashboard.tsx`:
   - Add `useQuery` calling the new server fn (keep existing client count query, or fold it into the same fn).
   - Replace the "—" placeholders on the Policies / Claims / Renewals tiles with real values from the fn.
   - Add a **Total revenue** tile (currency-formatted, with "this month" subtext).
   - Add a **Revenue by branch** card below the tiles: simple table (Branch · Policies · Revenue · Share %) using existing `Card` + `Table` primitives. Empty state when there are no payments yet.
   - Keep "Getting started" card.

3. No schema changes, no new migrations, no RLS edits — all tables and helper functions already grant the needed access.

## Out of scope
- Date-range picker (Reports page already has full filtering).
- Charts (kept as a plain table for density; Reports has the chart view).
- Currency selection — uses the existing formatting convention in the app.
