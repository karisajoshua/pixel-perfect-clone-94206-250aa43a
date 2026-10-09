# Database and tenant isolation

## Entities observed in authentication code
- `user_roles`: queried by `user_id` for role-based routing.
- `tenant_members`: queried by `user_id` for agency membership.
- `clients`: queried by `auth_user_id` to recognize customer portal users.

The Supabase project is referenced by `supabase/config.toml`. The inspected `drizzle/schema.ts` is generated and blank; **this is not evidence that the deployed database has no tables**.

## Required verification
1. Inventory all actual tables, foreign keys, indexes and migrations.
2. Verify RLS is enabled and correctly scoped for each sensitive table.
3. Test tenant A cannot read, modify, export or infer tenant B records.
4. Verify super-admin powers are limited and audited.
5. Confirm document storage policies, signed URL expiry and object-level access.
6. Review backups, retention, deletion and audit logging.

**Do not publish live database dumps or customer data.**
