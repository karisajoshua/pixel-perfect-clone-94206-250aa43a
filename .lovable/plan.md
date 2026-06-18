## Problem

When a **client** signs in, they see TWO sidebars: the staff "Agency Workspace" sidebar (Dashboard, Clients, Vehicles, Policies, Quotations…) AND the client portal sidebar (Overview, My Policies, Vehicles…). That's because portal pages live under `src/routes/_authenticated/portal/*`, and the parent `_authenticated` layout wraps every child in `<AppShell>` (the staff sidebar). The portal then adds its own `<PortalShell>` on top, producing the double-nav. Clients can also navigate to `/dashboard`, `/clients`, `/admin/*` etc., which they should never see.

Staff roles (manager, agent, viewer) also currently see admin-only links and pages because access is not gated by role beyond "logged in".

## Goal

- Clients see ONLY the client portal shell (single sidebar).
- Staff (admin/manager/agent/viewer) see ONLY the staff `AppShell`.
- Each role only sees and can reach the routes it is allowed to use; visiting a forbidden URL redirects to the user's home (clients → `/portal`, staff → `/dashboard`).

## Changes

### 1. Split portal out of the staff layout

Move portal routes out from under `_authenticated` into their own pathless layout so they no longer inherit `AppShell`.

```text
src/routes/
  _authenticated/route.tsx        -> AppShell + staff-only guard
    dashboard.tsx, clients.tsx, vehicles.tsx, policies.tsx,
    quotations.tsx, invoices.tsx, claims.tsx, renewals.tsx,
    reports.tsx, admin.*.tsx
  _portal/route.tsx               -> PortalShell + client-only guard
    portal/index.tsx, portal/policies.tsx, portal/vehicles.tsx,
    portal/invoices.tsx, portal/claims.tsx, portal/documents.tsx,
    portal/profile.tsx, portal/invoices.$id.tsx, portal/policies.$id.tsx
```

URLs stay the same (`/portal`, `/portal/policies`, …) — only the layout chain changes. The existing `src/routes/_authenticated/portal/` folder and its `route.tsx` are removed.

### 2. Role-based guards in each layout

`_authenticated/route.tsx` (staff):
- Require auth; fetch `user_roles`.
- If user has ONLY the `client` role → redirect to `/portal`.
- Otherwise continue, expose `roles` via route context.

`_portal/route.tsx` (client):
- Require auth; fetch `user_roles`.
- If user does NOT have the `client` role → redirect to `/dashboard`.

### 3. Per-role route gating for staff areas

Use `beforeLoad` on individual route files to allow only roles that should access them. Mapping:

| Route(s)                                                                       | Allowed roles                       |
| ------------------------------------------------------------------------------ | ----------------------------------- |
| `/dashboard`, `/reports`, `/renewals`                                          | admin, manager, agent, viewer       |
| `/clients`, `/clients/$id`, `/vehicles`, `/policies`, `/policies/$id`, `/quotations` | admin, manager, agent          |
| `/invoices`, `/invoices/$id`, `/claims`                                        | admin, manager, agent               |
| `/admin/*` (users, branches, insurers, import, notifications, emails, audit, docs) | admin only                      |

Viewer = read-only; for now they get Dashboard/Reports/Renewals only. Unauthorized URL → redirect to `/dashboard` with a toast "You don't have access to that page."

### 4. Hide nav links the user can't use

In `src/components/app-shell.tsx`:
- Filter the main `nav` array by role using the same mapping above.
- Keep the `adminNav` block guarded by `isAdmin` (already done).

Client portal already only lists portal links — no change to `portal-shell.tsx` nav.

### 5. Landing redirect after sign-in

`src/routes/index.tsx` (sign-in page) already routes to `/dashboard` after login. Update it to:
- After successful sign-in, fetch roles; if user has only `client` → `navigate({ to: "/portal" })`, else `/dashboard`.

This prevents a client from briefly landing on `/dashboard` and being bounced.

## Technical notes

- Add a tiny `src/lib/roles.ts` helper: `getMyRoles()` returns `AppRole[]` via `supabase.from("user_roles")`. Used by both layout `beforeLoad`s and the post-login redirect to avoid duplication.
- Per-route gating helper: `requireRole(roles: AppRole[])` returning a `beforeLoad` function that throws `redirect({ to: "/dashboard" })` when the check fails.
- No database/migration changes. No changes to server functions.
- `routeTree.gen.ts` regenerates automatically when route files move.

## Files

**New**
- `src/routes/_portal/route.tsx`
- `src/lib/roles.ts`

**Moved (same content, new path)**
- `src/routes/_authenticated/portal/*` → `src/routes/_portal/portal/*` (8 files)

**Edited**
- `src/routes/_authenticated/route.tsx` — add client-redirect guard
- `src/routes/index.tsx` — role-aware post-login redirect
- `src/components/app-shell.tsx` — filter nav by role
- `src/routes/_authenticated/admin.*.tsx` (8 files) — `beforeLoad` admin gate
- `src/routes/_authenticated/{clients,vehicles,policies,quotations,invoices,claims}.tsx` and `.$id.tsx` variants — `beforeLoad` staff gate

**Deleted**
- `src/routes/_authenticated/portal/route.tsx` (replaced by `_portal/route.tsx`)
