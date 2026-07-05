
# Multi-tenant platform

Convert the app from a single-agency system into a multi-tenant SaaS where each agency ("tenant") is isolated, has its own brand, staff, clients, data, and choice of underwriters. A super-admin oversees all agencies from a separate `/platform` portal.

## 1. Data model

New tables (all with RLS + grants):

- `tenants` — the agency: `name`, `slug`, `contact_email`, `contact_phone`, `address`, `city`, `country`, `logo_url`, `brand_primary`, `brand_secondary`, `brand_accent`, `tagline`, `status` (active/suspended), `plan` (free — placeholder for future billing), `onboarded_at`.
- `tenant_insurers` — link table `(tenant_id, insurer_id)`: which underwriters each agency works with. Drives insurer dropdowns and future real-time API loading.
- `tenant_members` — link `(tenant_id, user_id, role)` where role is the existing app_role. Replaces the "flat" user_roles model for tenant-scoped access.
- New enum value `super_admin` on `app_role`.

Add `tenant_id uuid` (FK → tenants, NOT NULL) to every tenant-owned table:
`branches, profiles, clients, vehicles, policies, quotations, invoices, invoice_items, payments, claims, client_communications, client_required_documents, service_requests, notifications, audit_log, user_sessions`.

Storage buckets stay the same but object paths get prefixed with `tenant_id/` and RLS policies check tenant membership.

## 2. Migration of current data

- Create one tenant "Zest Insurance Agency" (default) using existing agency details.
- Backfill `tenant_id` on every existing row to that tenant.
- Promote the current admin to `super_admin` AND keep them as admin of the default tenant.
- Link all currently seeded insurers to the default tenant via `tenant_insurers`.

## 3. RLS rewrite

Replace `has_role(uid, role)` checks with a new helper:

- `current_tenant_id()` — reads tenant from `tenant_members` for `auth.uid()` (falls back to profile.tenant_id).
- `is_tenant_member(tenant_id, role)` — security definer.
- `is_super_admin()` — security definer.

Every tenant-owned table policy becomes: `tenant_id = current_tenant_id() OR is_super_admin()`, with role-based write checks layered on top. `enforce_creator_branch` extended to also stamp `tenant_id` on insert.

## 4. Onboarding wizard (`/onboarding`)

Public route reachable right after signup when the user has no tenant. 4 steps:

1. **Agency details** — name, contact email/phone, address, city, country.
2. **Brand assets** — logo upload (to new `tenant-brand` public bucket), primary/secondary/accent colors (color pickers), tagline.
3. **Underwriters** — checkbox grid of the 14 preloaded insurers; picks populate `tenant_insurers`.
4. **First branch & team** — create head-office branch, optionally invite teammates by email (reuses existing invite flow, scoped to new tenant).

On finish: creates `tenants` row, `tenant_members` (current user as admin), `branches`, `tenant_insurers`; sets `profiles.tenant_id`; redirects to `/dashboard`.

## 5. Branded quotes / invoices / receipts

- Add server helper `getTenantBrand(tenantId)` returning `{ name, logo_url, colors, contact, address }`.
- Update PDF generators (`invoice-pdf.ts`, `quotation-pdf.ts`, `receipt-pdf.ts`) to accept and render tenant brand (logo, colors, footer contact) instead of the hard-coded Zest branding.
- Portal shell + emails also read tenant brand so each agency's clients see their agency's identity.

## 6. Super-admin portal (`/platform`)

New pathless layout `_platform/route.tsx` gated by `is_super_admin()`. Pages:

- `/platform` — overview: total agencies, total clients across all tenants, total revenue, active policies, MoM growth.
- `/platform/agencies` — table of every agency with KPIs (clients, active policies, revenue this month, open claims, status). Row click → drill-in.
- `/platform/agencies/$id` — one agency's KPIs, branches, members, insurers, recent activity; suspend/activate actions.
- `/platform/insurers` — manage the global insurer catalogue that agencies pick from.

All data via new `platform.functions.ts` server fns using `supabaseAdmin` (bypasses tenant RLS) and gated by `requireSupabaseAuth` + `is_super_admin` check inside the handler.

## 7. Insurer selection in-app

Everywhere the app currently lists insurers (policy form, quotation form, etc.), swap the source from "all insurers" to "insurers linked to `current_tenant_id()`". Add `/admin/insurers` inside the tenant admin so agency admins can toggle their underwriters after onboarding.

## 8. Route/auth changes

- Root sign-in flow: after `SIGNED_IN`, check if user has a tenant. If not → `/onboarding`. If super-admin only → `/platform`. Else `/dashboard`.
- `_authenticated` layout enforces tenant membership; `_platform` enforces super-admin.
- Existing `/portal` (client portal) stays; scoped by `clients.tenant_id`.

## 9. Out of scope

- Billing/payments for agencies (structure only — `plan` field placeholder).
- Custom domains per tenant.
- Cross-tenant data sharing.
- Real underwriter API integration (data model prepped, actual API wiring is later).

## Technical notes

- New migration: enum + tables + tenant_id columns + backfill + policy rewrite. Single migration file, run in order: create → grant → RLS → policy. Include update triggers.
- Delete/replace ~all existing RLS policies on affected tables; keep helpers `user_branch`, `has_role` but layer tenant check on top.
- File uploads for logos: create `tenant-brand` public bucket via `storage_create_bucket`.
- Update `handle_new_user` trigger: no longer auto-assigns admin/agent role; new users start with no tenant → wizard assigns role.
- Client-linking-by-email path in `handle_new_user` becomes tenant-scoped (email + tenant_id lookup).
- `getDashboardSummary` and `getReportsSummary` already scope by branch; add tenant scoping (implicit via RLS) — verify queries still work after RLS changes.
