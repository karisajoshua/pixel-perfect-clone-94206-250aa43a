## Change

On the Dashboard (`src/routes/_authenticated/dashboard.tsx`), conditionally render the **Total revenue** card so it is only visible when the current user has the `admin` role.

- Use `useMyRoles` from `@/hooks/use-auth` to read roles in the `Dashboard` component.
- Wrap the top `Card` (lines 50-62) in `{isAdmin && ...}`.
- No other dashboard content changes — the KPI tiles and Revenue by branch table remain visible to all non-client users.

## Technical detail

- `useMyRoles` returns an array of role strings (`"admin" | "manager" | "agent" | "viewer" | "client"`).
- `const isAdmin = roles?.includes("admin")` provides the gate.