## What's wrong today

1. **App UI still shows Zest brand for every agency.** `src/components/app-shell.tsx` hardcodes the Zest logo asset and the sidebar/primary colors come from static CSS tokens — the tenant's `logo_url`, `name`, and `brand_primary/secondary/accent` are only used inside PDFs.
2. **New agency sees Zest staff sessions.** `listStaffSessions` in `src/lib/sessions.functions.ts` uses `supabaseAdmin` (bypasses RLS) and queries `user_roles` + `user_sessions` with no tenant filter, so every admin sees every tenant's users.
3. **New signups are auto-put into the Zest tenant.** The `handle_new_user` trigger writes `profile.tenant_id = <first tenant>` (which is Zest). Any staff a new agency tries to add through plain sign-up land in Zest — and there is no proper "invite a teammate" flow scoped to the current tenant.

## The plan

### 1. Tenant-aware app branding

- Add `getMyBrand` server fn (in `src/lib/tenants.functions.ts`) that returns `{ name, logo_url, brand_primary, brand_secondary, brand_accent, tagline }` for the caller's tenant (via `tenant_members`). Uses the authed client, so RLS keeps it tenant-safe.
- New `src/components/tenant-brand-provider.tsx`:
  - Fetches brand via TanStack Query, keyed by user id.
  - Injects a `<style>` tag that overrides the semantic tokens driving the sidebar/primary look (`--primary`, `--sidebar`, `--sidebar-primary`, `--sidebar-accent`, `--ring`) by converting the tenant hex colors to the HSL triplet format the tokens already use.
  - Exposes the brand via context so the shell can pull `name` and `logo_url`.
- Mount the provider inside `AppShell` (and `PortalShell`, so client portal is also branded).
- Update `AppShell`:
  - Replace `logoWhite.url` with `brand.logo_url ?? logoWhite.url` in both the sidebar header and mobile top bar.
  - Replace the "Zest" fallback title and alt text with `brand.name`.
  - Show `brand.name` as the sidebar heading.
- Reset the query on sign-in/sign-out so switching accounts refreshes the brand.

### 2. Stop leaking Zest staff into new agencies

Two migrations:

**a. Stop auto-assigning new signups to Zest.**
- Update `public.handle_new_user()` so it inserts `profiles(id, full_name, email, tenant_id=NULL)` — no more "default tenant".
- Backfill: for existing profiles that (i) have `tenant_id = <Zest tenant>` and (ii) have no `tenant_members` row for that tenant, set `tenant_id = NULL`. That cleans up test signups that were accidentally placed in Zest.

**b. Add tenant-scoped RLS so cross-tenant admin queries return nothing.**
- The existing `tenant_isolation` RESTRICTIVE policy already covers `profiles`, but `user_roles` was skipped. Add a RESTRICTIVE policy on `user_roles` that requires the row's `user_id` to belong to a profile in `current_tenant_id()` (or `is_super_admin()`).

**c. Rewrite `listStaffSessions` to scope by tenant.**
- Use the authed `context.supabase` (not `supabaseAdmin`).
- Fetch `profiles` in current tenant → get `user_id` list → fetch `user_sessions` (already has `tenant_isolation`) → join `user_roles` filtered to those user ids.
- Result: each agency admin only sees sessions of their own staff.

### 3. Give new agencies a proper "add staff" flow

- New server fn `inviteStaff({ email, phone, full_name, role, branch_id })` in `src/lib/admin-users.functions.ts`:
  - Asserts caller is `admin`/`manager` of a tenant.
  - Creates the auth user via `supabaseAdmin.auth.admin.createUser` (email+password, returns temporary password to display once).
  - Since `handle_new_user` now leaves `tenant_id` NULL, the server fn then:
    - Sets `profiles.tenant_id`, `branch_id`, `full_name`, `phone` for the new user.
    - Inserts `tenant_members(tenant_id, user_id, role)`.
    - Inserts `user_roles(user_id, role)` for the chosen app role.
- Update `src/routes/_authenticated/admin.users.tsx`:
  - Add an "Invite staff" button + dialog (name, email, phone, role, branch) that calls `inviteStaff` and shows the temporary password.
  - Keep the existing edit/role/branch/delete controls; they already act only on tenant-visible profiles via RLS.
- The onboarding wizard already covers the very first user; this flow handles everyone after.

### Out of scope

- Full email invitation delivery (we surface the temp password in-app for now).
- Retroactively splitting existing Zest data into other tenants — Zest keeps its current staff; only unassigned/test profiles get detached.

## Technical notes

- Files to add: `src/components/tenant-brand-provider.tsx`, one Supabase migration (updates `handle_new_user`, adds `user_roles` RESTRICTIVE policy, backfills orphan profiles).
- Files to edit: `src/lib/tenants.functions.ts` (add `getMyBrand`), `src/lib/sessions.functions.ts` (tenant-scope `listStaffSessions`), `src/lib/admin-users.functions.ts` (add `inviteStaff`), `src/components/app-shell.tsx`, `src/components/portal/portal-shell.tsx`, `src/routes/_authenticated/admin.users.tsx`.
- Semantic token override strategy: our `styles.css` tokens are HSL triplets (`--primary: 217 91% 60%`). The provider converts the tenant hex → HSL and writes those tokens on `:root` inside the authed area, so all shadcn components (buttons, links, active nav) re-tint automatically.
- Zest's own tenant row keeps its current colors, so nothing changes for the existing Zest admin experience.
