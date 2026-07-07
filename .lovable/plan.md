## Problem

When a client signs in with the generated portal credentials, they land on the agency onboarding wizard instead of the client portal.

Root cause: a RESTRICTIVE policy on `user_roles` (migration `20260705114247…`) requires the row's user profile to share the current tenant. Client users don't belong to a tenant, so `select role from user_roles` returns **zero rows** for them. In `src/routes/index.tsx` and `src/routes/_authenticated/route.tsx` the redirect logic then sees "no client role, no tenant membership, not super admin" and sends them to `/onboarding`.

## Fix

Two small, targeted changes — no business-logic changes elsewhere.

### 1. Migration: let users read their own roles

Amend the restrictive policy on `public.user_roles` so a user can always see their own row, while preserving tenant isolation for viewing other users' roles.

```sql
DROP POLICY IF EXISTS user_roles_tenant_isolation ON public.user_roles;
CREATE POLICY user_roles_tenant_isolation ON public.user_roles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR user_roles.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.tenant_id = public.current_tenant_id()
    )
  );
```

WITH CHECK stays strict so no one can grant themselves a role outside their tenant.

### 2. Defensive fallback in the post-sign-in redirect

In `src/routes/index.tsx` (both the `useEffect` session check and the `signIn` handler) and in `src/routes/_authenticated/route.tsx` `beforeLoad`, after fetching roles/membership, if the user has no roles and no tenant membership, look up `clients` by `auth_user_id = uid`. If a client row exists → redirect to `/portal`. Only if that also fails → `/onboarding`.

This guarantees that even if role reads are ever blocked again, existing client accounts still route correctly.

Only agency signups (created via `/` → "Create account" tab) — who have no linked client record and no tenant membership — will reach `/onboarding`.

## Files touched

- `supabase/migrations/<new timestamp>_client_can_read_own_role.sql` (new)
- `src/routes/index.tsx`
- `src/routes/_authenticated/route.tsx`
