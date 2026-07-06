## Fix: admins can't add a branch

### Root cause
`public.branches.tenant_id` is `NOT NULL` with no default. The admin form (`src/routes/_authenticated/admin.branches.tsx`) inserts only the form fields, so the insert fails on the NOT NULL constraint and would also violate the `tenant_isolation` RLS `WITH CHECK (tenant_id = current_tenant_id())`.

The project already has a `public.enforce_creator_tenant()` function that sets `NEW.tenant_id := current_tenant_id()` on insert, but no trigger is attached to `branches`.

### Change
Single migration: attach a `BEFORE INSERT` trigger on `public.branches` that runs `public.enforce_creator_tenant()`, so admin inserts automatically get the caller's tenant. No code or UI changes required — the existing form and RLS policies work once `tenant_id` is stamped.

```sql
CREATE TRIGGER branches_set_tenant
BEFORE INSERT ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_tenant();
```

### Out of scope
- No changes to the branches form or RLS policies.
- Other tenant-scoped tables missing the same trigger are not touched here; if you want, I can audit them in a follow-up.
