## Root cause

When `createClientPortalAccount` creates the auth user, the database trigger `handle_new_user` runs first. Because the new portal user is created via **phone** (no matching email on the `clients` table), the trigger falls through to its default branch and inserts the **`agent`** role.

The server function then upserts the **`client`** role — so the user ends up with **both** `agent` and `client` roles.

The `_authenticated` route gate only redirects to `/portal` when `roles.every(r => r === "client")`. With an extra `agent` row, the client lands on the staff dashboard.

## Fix

In `src/lib/admin-users.functions.ts`, inside `createClientPortalAccount`, after `auth.admin.createUser` succeeds:

1. **Delete any non-client roles** the trigger may have inserted for the new user:
   ```ts
   await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id).neq("role", "client");
   ```
2. Then upsert the `client` role (existing code).

Also apply the same cleanup in the "linked existing user" branch only if that existing user has no staff intent — skip it there to avoid demoting real staff who happen to share contact info. The branch already just adds `client` alongside existing roles; leave it alone.

## One-time data fix for the already-created portal user

The client you already generated (`254729442321`, user `af0fda07-…`) currently has both roles. A migration cleans it up safely:

```sql
DELETE FROM public.user_roles
WHERE role <> 'client'
  AND user_id IN (SELECT auth_user_id FROM public.clients WHERE auth_user_id IS NOT NULL);
```

This only affects auth users that are linked to a `clients` row, so staff accounts are untouched.

## Files

- `src/lib/admin-users.functions.ts` — add the delete-extra-roles step in the create branch.
- `supabase/migrations/<new>.sql` — the one-time cleanup above.

No UI changes; the existing `_authenticated` and `/portal` gates already do the right thing once roles are correct.
