## 1. Clients-per-branch count

**`src/lib/dashboard.functions.ts`** — extend `getDashboardSummary`:
- Fetch `clients` with `branch_id` (admin scope) or a single-branch count (non-admin) instead of the current `head:true` count.
- Aggregate a `clientsByBranch: Map<branchId, number>` alongside the existing `polByBranch` / `revByBranch`.
- Add `clients: number` to each `byBranch` row in the returned `DashboardSummary` type.

**`src/routes/_authenticated/dashboard.tsx`** — "Revenue by branch" table:
- Add a `Clients` column between Branch and Policies.
- Sum in the "All branches" total row.

**`src/routes/_authenticated/admin.branches.tsx`** — branches admin table:
- Load `clients (branch_id)` counts once (single grouped query) and render a `Clients` column next to Name/Code/Email/Phone so admins see the effect of reassignments immediately.

No schema change needed — this is purely a read/UI update, so moving a client between branches will reflect on the next refresh.

## 2. Performance pass

### Database indexes (new migration)

Add btree indexes covering the hot filter/join paths used by dashboard, reports, and list pages. All are additive, safe, and small:

```text
policies:      (branch_id), (status), (end_date), (client_id), (insurer_id), (created_by)
claims:        (branch_id), (status), (client_id), (policy_id)
clients:       (branch_id), (tenant_id), (auth_user_id)
invoices:      (branch_id), (client_id), (status)
payments:      (invoice_id), (paid_date)
vehicles:      (client_id)
quotations:    (client_id), (status)
user_roles:    (user_id, role)     -- speeds has_role() and role checks
profiles:      (branch_id)
audit_log:     (entity_type, entity_id), (created_at desc)
```

### Server-function query shape

- `dashboard.functions.ts`: replace the full-table `select("*")` fetches used purely for counts (clients, claims-by-status, policies-by-status) with `select("id", { count: "exact", head: true })` per bucket, or a single narrow projection. Only the byBranch aggregates need row data — narrow those selects to the exact columns used (`branch_id, status, premium_gross, start_date, end_date, cancelled_at`).
- `reports.functions.ts`: same narrowing; drop unused columns from the big `select`s.

### Client caching / prefetch

- Bump route `staleTime` on `dashboard.tsx` and `reports.tsx` to `60_000` (and `gcTime` `5*60_000`) so navigating away and back is instant.
- Use `context.queryClient.ensureQueryData(queryOptions)` in the route loader for dashboard + reports so data starts fetching during navigation rather than after mount.
- Set React Query default `staleTime: 30_000` in `getRouter` so common lookup queries (branches, insurers, profiles) stop refetching on every mount.

### Route data-loading cleanup

- Convert any list page still using `useEffect` + `supabase.from(...)` to `useQuery` with a stable `queryKey` (checked during implementation; only touch pages that need it).
- Ensure Query is invalidated on the relevant mutations only (avoid `invalidateQueries()` with no key on sign-in events — already handled in `__root.tsx`).

### Verification

- `supabase--slow_queries` before and after to confirm the indexes take effect.
- Reload dashboard + reports and check network timing drops.

## Files touched

- `src/lib/dashboard.functions.ts`
- `src/routes/_authenticated/dashboard.tsx`
- `src/routes/_authenticated/admin.branches.tsx`
- `src/lib/reports.functions.ts`
- `src/router.tsx` (default query staleTime)
- New migration: `supabase/migrations/<ts>_perf_indexes.sql`
