## Goal
Make `manager` a branch-scoped role. Managers see only their branch's data (clients, policies, claims, invoices, payments, vehicles, quotations, reports). `admin` keeps full access and the cross-branch breakdown.

## What changes

### 1. Database — tighten RLS for `manager`
Today every `SELECT`/write policy treats `manager` the same as `admin` (full access). New rule: `admin` = unrestricted, `manager` = restricted to rows where the row's `branch_id` matches `user_branch(auth.uid())`. Agents/viewers keep their existing scope. Client portal policies (`current_client_id()`) are untouched.

Tables and fields updated via one migration:

| Table | Scope rule for manager |
|---|---|
| `clients` | `branch_id = user_branch(uid)` |
| `policies` | `branch_id = user_branch(uid)` |
| `claims` | `branch_id = user_branch(uid)` |
| `invoices` | `branch_id = user_branch(uid)` |
| `quotations` | `branch_id = user_branch(uid)` |
| `vehicles` | parent client's `branch_id = user_branch(uid)` |
| `invoice_items` | parent invoice's client `branch_id = user_branch(uid)` |
| `payments` | parent invoice's client `branch_id = user_branch(uid)` |
| `client_communications` | parent client's `branch_id = user_branch(uid)` |
| `service_requests` | `branch_id = user_branch(uid)` |

Writes (`INSERT`/`UPDATE`/`DELETE`) for manager get the same branch check via `WITH CHECK`, so a manager cannot create or move a record into another branch. `admin` policies stay open.

Reference tables (`branches`, `insurers`, `profiles`, `user_roles`, `audit_log`) keep current rules — managers can still read the list of branches/insurers needed to render dropdowns.

### 2. Server functions — auto-scope reports & dashboard
- `getDashboardSummary` (`src/lib/dashboard.functions.ts`): if caller is not admin, force-filter every query by `user_branch(uid)` and return `byBranch` containing only that one branch.
- `getReportsSummary` (`src/lib/reports.functions.ts`): if caller is not admin, ignore any `branchId` from the client and substitute the caller's own `user_branch`. Branch performance section collapses to the single branch for managers.
- Add a small helper `getCallerScope(supabase, userId)` returning `{ isAdmin, branchId }` reused by both.

RLS already enforces this at the DB layer; the server-fn change is so charts/KPIs don't show a misleading "Unassigned/Unknown" zero row.

### 3. UI — hide cross-branch controls for non-admins
- Reports page (`src/routes/_authenticated/reports.tsx`): the branch filter dropdown renders only when the user has the `admin` role. Managers see a static "Branch: <their branch name>" label.
- Admin sidebar entries (Branches, Insurers, Users, Audit, Sessions, Notifications, Requests, Security, Import, Docs, Emails) already live under `/admin/*`; gate the nav links so only `admin` sees them. Managers keep Clients / Policies / Claims / Invoices / Quotations / Vehicles / Reports / Renewals / Dashboard.
- No changes to the client portal.

## Technical notes
- Policies are rewritten with `DROP POLICY IF EXISTS … CREATE POLICY …` inside one migration per table; no schema changes.
- Manager branch comes from `profiles.branch_id` via the existing `public.user_branch(_user_id uuid)` security-definer function — no new SQL functions needed.
- A manager with no `branch_id` set on their profile will see zero rows. The admin Users page already lets admins assign a branch; we'll surface a one-line warning banner on the dashboard when a staff user has no branch.
- Existing role check helper `useMyRoles()` is reused in the UI; no new hook.

## Out of scope
- Changing what data `agent` / `viewer` see (already branch-scoped).
- Multi-branch managers (one branch per manager via `profiles.branch_id`). If you later need a manager over several branches, we'd add a `manager_branches` table — flag it and I'll plan that separately.