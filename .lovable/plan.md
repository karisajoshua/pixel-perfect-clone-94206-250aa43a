
## Goal
Turn `/platform` into a real super-admin console: filterable agency list, drillable detail view, and the ability to send notices/notifications to one or all agencies. Add supporting operational tools (plan changes, impersonation-style workspace open, activity feed) that make it feel like a super admin.

## 1. Filterable, sortable agencies list
Update `src/routes/_platform/platform/agencies.tsx`:
- Search box (name / contact email).
- Status filter (all / active / suspended).
- Plan filter (all / starter / pro / enterprise — from existing `plan` column).
- Sort by name, clients, active policies, revenue (client-side over the overview payload).
- Row click navigates to `/platform/agencies/$id` (already exists). Add a "View" button too.
- Show onboarded date column.

No new server fn needed — `getPlatformOverview` already returns everything; filter/sort in the component.

## 2. Richer agency detail page
Extend `src/routes/_platform/platform/agencies.$id.tsx` and `getAgencyDetail` in `src/lib/platform.functions.ts`:
- Add: recent claims (last 10), recent invoices (last 10 with paid state), monthly revenue for the last 6 months (aggregated from `payments`).
- Add "Actions" card with:
  - Suspend / activate (exists).
  - **Change plan** dropdown (starter / pro / enterprise) → new `setAgencyPlan` server fn.
  - **Open workspace** button → link to `/dashboard` after switching context (see §4).
  - **Send notice to this agency** button → opens the broadcast dialog prefilled with this tenant.
- Small activity timeline: latest 20 rows from `audit_log` for this tenant.

## 3. Platform notices & notifications
New feature so super admin can message agencies.

**Data (migration):**
- `platform_notices` table: `id`, `title`, `body` (text), `severity` (info|warning|critical), `audience` ('all' | 'tenant'), `tenant_id` (nullable), `created_by`, timestamps.
- `platform_notice_reads`: `notice_id`, `user_id`, `read_at` — to dismiss per user.
- GRANTs + RLS: super admins full access; tenant members can SELECT notices where `audience='all'` OR `tenant_id = current_tenant_id()`; can insert their own read row.
- Also fan out into existing `notifications` table (one row per admin/manager of the target agency/agencies) so the in-app bell picks it up immediately.

**Server fns (`src/lib/platform.functions.ts`):**
- `listPlatformNotices()` — super-admin view of all notices sent.
- `sendPlatformNotice({ title, body, severity, audience, tenant_id? })` — inserts notice + fans out `notifications` rows.

**UI:**
- New route `src/routes/_platform/platform/notices.tsx`: list of past notices with a "New notice" dialog (title, body, severity, audience selector: All agencies / specific agency dropdown).
- Sidebar link "Notices" added in `src/routes/_platform/route.tsx`.
- On the tenant side, a lightweight `PlatformNoticeBanner` component renders at the top of `AppShell` for undismissed notices (queries `platform_notices` filtered to audience + tenant, with dismiss button that writes to `platform_notice_reads`).

## 4. Extra super-admin polish
- **Platform sidebar**: add links for Overview, Agencies, Notices, Insurers catalog (read-only reuse of existing insurers admin), Audit log.
- **Audit route** `src/routes/_platform/platform/audit.tsx`: cross-tenant `audit_log` viewer with tenant/action filter (server fn `getPlatformAuditLog`).
- **Open workspace**: from agency detail, "View as this agency" button just sets `localStorage['zia_impersonate_tenant']` (advisory, super admin sees a banner) and navigates to `/dashboard`. Full impersonation is out of scope; this just labels the current context. Skip if too invasive — keep only the outbound `/dashboard` link.
- **Overview page** gets two new tiles: "Notices sent (30d)", "New agencies (30d)".

## Out of scope
- Email delivery of notices (in-app + notification bell only for now).
- True auth impersonation (would require signing in as another user).
- Billing/plan enforcement — plan is just a label.

## Technical notes
- All new server fns use `requireSupabaseAuth` + `assertSuperAdmin` helper already in `platform.functions.ts`.
- Fan-out inserts use `supabaseAdmin` (loaded inside handler).
- Migration must include GRANTs and RLS per project rules; new tables both need `authenticated` grants; `platform_notices` also needs `SELECT` for tenant members via policy.
- Reuse shadcn `Dialog`, `Select`, `Textarea`, `Input`, `Badge` — no new dependencies.

## Files
- edit `src/lib/platform.functions.ts` (extend detail + plan + notices + audit)
- edit `src/routes/_platform/platform/agencies.tsx` (filters, sort)
- edit `src/routes/_platform/platform/agencies.$id.tsx` (new sections + actions)
- edit `src/routes/_platform/platform/index.tsx` (extra tiles)
- edit `src/routes/_platform/route.tsx` (sidebar links)
- new `src/routes/_platform/platform/notices.tsx`
- new `src/routes/_platform/platform/audit.tsx`
- new `src/components/platform/send-notice-dialog.tsx`
- new `src/components/platform-notice-banner.tsx` + mount in `src/components/app-shell.tsx`
- new migration: `platform_notices`, `platform_notice_reads` (+ GRANTs, RLS, triggers)
