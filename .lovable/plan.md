## 1. Sidebar reorder

In `src/components/app-shell.tsx`, reorder the top-level `nav` array so it reads:

1. Dashboard
2. Clients
3. Quotations
4. Vehicles
5. Policies
6. Invoices
7. Claims
8. Renewals
9. Service requests
10. Reports

(Currently Vehicles comes before Quotations, and Quotations sits after Policies.) No role changes, no route changes.

## 2. Managers see the central client database

Update the `clients` table SELECT RLS policy so managers can read every client in their agency, not just their branch. Admins already see all; agents/viewers stay branch‑scoped as today. Tenant isolation via `current_tenant_id()` is preserved.

Migration replaces `clients read scope` with:

- `admin` → all
- `manager` → all (within tenant, enforced by existing `tenant_isolation` policy)
- `viewer` → unassigned or own branch (unchanged)
- `agent` → unassigned, own branch, or assigned to them (unchanged)

Other tables (vehicles, policies, claims, invoices) keep their current branch scoping — the request was specifically about clients.

## 3. Dashboard metrics stay branch‑scoped for managers

No change to `src/lib/dashboard.functions.ts`. It already scopes counts to the signed‑in user's `profile.branch_id` for every non‑admin (managers included), so a manager's dashboard tiles and "clients / active policies / claims / renewals" continue to reflect only their branch, even though they can now browse the full client list on `/clients`.

Admins continue to see agency‑wide totals and the "Revenue by branch" table.
