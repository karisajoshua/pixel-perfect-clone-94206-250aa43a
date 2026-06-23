# Branch performance visibility for managers

## Goal

On the Reports page, the **Branch performance** table should:

- **Admin** — unchanged: see every branch with Policies, **Premium**, Claims.
- **Manager** — see every branch with Policies and Claims (counts only). The **Premium** column is hidden so managers can't see other branches' revenue.

Every other section on Reports (KPIs, Revenue over time, Insurer portfolio, Claims funnel, Top agents) stays scoped to the manager's own branch as it is today. Only the Branch performance table widens for managers.

## Changes

### 1. `src/lib/reports.functions.ts`
- Add a new field on the response: `branchPerformanceAll: { branch, policies, claims }[]` — counts across all branches, no premium.
- Compute it by querying `policies` and `claims` without the branch filter (just `id, branch_id` for policies; `id, branch_id` for claims) when the caller is a manager. Admins don't need this extra payload — they already get full `branchPerformance` with premium.
- Existing `branchPerformance` (with premium) stays admin-only data; for managers it will contain only their own branch row as it does today.

### 2. `src/routes/_authenticated/reports.tsx`
- In the Branch performance `DataTable`:
  - If `isAdmin`: render as today — `["Branch", "Policies", "Premium", "Claims"]` from `branchPerformance`.
  - If manager: render `["Branch", "Policies", "Claims"]` from `branchPerformanceAll`.
- Update `buildCsv` to match: managers' CSV omits the Premium column in the branch section.

## Out of scope

- No changes to other charts/KPIs or to the manager-scope RLS that hides client/policy/claim rows from other branches.
- No changes to the Top agents table (still scoped to manager's own branch).
- No changes to the Dashboard's "Revenue by branch" card (admin-only already).
