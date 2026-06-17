## Client Portal (`/portal`)

Read-only-ish portal for end clients to view their policies, vehicles, invoices, claims, and download documents. Reuses the existing `client` app_role and integrates with the current `_authenticated` gate.

### 1. Data link: auth user ↔ client record

Migration `add_client_auth_link`:
- `ALTER TABLE clients ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE`.
- Backfill: `UPDATE clients c SET auth_user_id = u.id FROM auth.users u WHERE c.email = u.email AND c.auth_user_id IS NULL`.
- Update `handle_new_user()` trigger: when a new auth user signs up, if a `clients` row matches by email, set `auth_user_id` and grant `client` role (skip the default `agent` grant for that path). First-user `admin` rule unchanged.
- RLS: add policies allowing a user with `has_role(uid,'client')` to `SELECT` their own `clients` row, plus related `policies / vehicles / invoices / invoice_items / payments / claims / client_communications` rows scoped by `client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())`. INSERT policy on `claims` for self (status forced to `reported`).
- Storage: policy on `client-documents` bucket allowing the matching client to `SELECT` (download) objects whose path begins with their `client_id/`.

### 2. Routing & shell

- New layout `src/routes/_authenticated/portal/route.tsx` — pathless gate: fetch caller's role; if not `client`, `redirect({ to: '/dashboard' })`. Renders a portal-specific shell (separate from `AppShell`) with the ZIA red logo, top nav, sign-out, and the signed-in client's name.
- Update staff `AppShell` / dashboard route: if signed-in user has only `client` role, redirect to `/portal`.
- Update `src/routes/index.tsx` post-login redirect: clients → `/portal`, staff → `/dashboard`.

### 3. Portal pages

```text
/portal                  Overview: active policies count, next renewal, outstanding balance, recent activity
/portal/policies         List of own policies (insurer, vehicle, period, status, premium)
/portal/policies/$id     Detail + download policy PDF + linked invoices
/portal/vehicles         Own vehicles (reg, make/model, year, current policy)
/portal/invoices         Invoices with status, amount due, download PDF
/portal/invoices/$id     Line items + payments history
/portal/claims           Own claims with status timeline + "Report a claim" form (creates row, status=reported, notifies branch via existing notification system)
/portal/documents        Files from client-documents bucket under their client_id prefix
/portal/profile          Read-only personal details + contact-support CTA
```

All data via `createServerFn` with `requireSupabaseAuth`; RLS does the scoping. TanStack Query for caching (60s stale). Empty/loading/error states on every page.

### 4. Files

Create:
- `supabase/migrations/<ts>_client_portal.sql`
- `src/routes/_authenticated/portal/route.tsx` + 9 page files above
- `src/components/portal/portal-shell.tsx`, `portal-sidebar.tsx`
- `src/lib/portal.functions.ts` (overview, policies, vehicles, invoices, claims, documents, create-claim)

Edit:
- `src/integrations/supabase/` — types regen post-migration
- `src/routes/index.tsx` (post-login role-based redirect)
- `src/routes/_authenticated/dashboard.tsx` (redirect clients to `/portal`)
- `src/components/app-shell.tsx` (hide staff nav for client role as defense-in-depth)

### Out of scope

Online payments, document upload by client, 2FA, in-app messaging — deferred to later hardening phase.