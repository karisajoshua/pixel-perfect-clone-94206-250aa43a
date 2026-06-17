## Zest Insurance Agency — In-House Management System

A multi-branch, role-based agency platform covering all 14 modules in the PRD, plus a customer self-service portal. Built on Lovable Cloud (Postgres + Auth + Storage) with a TanStack Start frontend.

### Visual direction
- Theme: **Zest Citrus** — slate (#0F172A / #1E293B) shell with amber (#F59E0B) and yellow (#FACC15) accents, white surfaces.
- Typography: Inter (body) + a tighter display weight for headings.
- Layout: sidebar nav for staff workspace, top-bar for client portal, dashboard cards with KPI tiles, data tables with filters.

### Roles
- **Admin** — full access, user/branch management, settings.
- **Manager** — branch-wide read/write, approvals (quotes, claims).
- **Agent** — day-to-day client/policy/claim work in their branch.
- **Viewer** — read-only reports.
- **Client** — portal-only access to their own policies/invoices/claims.

Roles stored in a separate `user_roles` table with a `has_role()` SECURITY DEFINER function (per security guidelines).

---

### Phase 1 — Foundation
- Enable Lovable Cloud.
- Auth: email/password + Google sign-in; `/auth`, `/reset-password`, `_authenticated` gate, `/portal` gate for clients.
- Schema: `profiles`, `branches`, `user_roles` (enum: admin/manager/agent/viewer/client), `audit_log`.
- Layout shell: sidebar (Dashboard, Clients, Vehicles, Policies, Quotations, Invoices, Claims, Reports, Admin), top bar with branch switcher + user menu.
- Admin pages: Users (invite, assign role + branch), Branches (CRUD), Activity log.
- Clients module: list/search/filter, individual & corporate profiles, contact details, KYC document uploads (Storage bucket), communication log.

### Phase 2 — Core Operations
- Vehicles: registration, specs, ownership/transfer history, logbook upload, inspection scheduling, per-vehicle policy history.
- Documents: unified Storage browser, KYC expiry tracking, version history on policy docs, previews for images/PDFs, branch-scoped sharing.
- Policies: CRUD with unique reference numbers, insurer, product type, premium, start/end dates, status (active/expired/cancelled/pending renewal), assigned agent, linked client + vehicle, calendar + dashboard views, renewal workflow with manager approval, archived history.
- Quotations: builder with configurable cover types & rates, branded PDF template, revision tracking, manager sign-off, conversion-to-policy with audit link.

### Phase 3 — Automation, Billing & Claims
- Renewal reminder engine: configurable lead times (e.g. 30/14/7/1 day), pg_cron job hitting an `/api/public/cron/renewals` route (HMAC-verified) that dispatches Email (Resend), SMS (Africa's Talking), and WhatsApp (Meta Cloud API). Escalation to manager on overdue. Reminder log table.
- Invoices: generation from policies/quotes, unique refs, statuses (pending/partial/paid/overdue), payment recording, branded PDF, client billing history.
- Claims: registration with unique ref, police abstract / driver license / national ID / accident statement / sketch uploads, multi-vehicle (third-party) support, status workflow (registered → under review → approved → settled), assignment, notes timeline.

### Phase 4 — Portal, Reports & Hardening
- Client self-service portal (`/portal/*`): login, view active policies + schedule, download certificates/receipts, submit renewal & cancellation requests, payment history.
- Reports & analytics dashboard: expiring policies, monthly renewals + conversion, revenue (period/branch/insurer/product), branch & staff performance, insurer portfolio, claims-vs-revenue. CSV export + chart views (Recharts).
- Security hardening: 2FA opt-in for admins, password complexity, HIBP check enabled, full audit log on sensitive writes, signed Storage URLs, daily backup note in admin settings.
- Mobile responsiveness pass across all modules.

### Phase 5 — Polish & Handover
- Empty states, loading skeletons, toast feedback, keyboard shortcuts on list pages.
- Seed demo data migration (one branch, sample clients/policies/claims) for UAT.
- In-app help drawer with quickstart, admin guide page, links to docs.
- SEO metadata on public routes (landing + auth).

---

### Technical notes
- **Stack:** TanStack Start + Tailwind v4 + shadcn/ui; Lovable Cloud (Postgres, Auth, Storage); server functions via `createServerFn` with `requireSupabaseAuth`; pg_cron + `/api/public/*` route for scheduled reminders.
- **Notifications:** requires user-supplied secrets — `RESEND_API_KEY`, `AFRICASTALKING_API_KEY` + username, `WHATSAPP_TOKEN` + phone-number-id, `CRON_WEBHOOK_SECRET`. Channels degrade gracefully if a secret is absent.
- **PDFs:** server-rendered branded PDFs for quotes, invoices, certificates.
- **RLS:** every table branch-scoped via `has_role()` + branch membership; clients see only their own rows.
- **Scope deferred / not included:** native mobile apps, insurer API integrations (PRD calls these "potential future"), live payment gateway (manual payment recording only).

### Build order each phase
1. Migration (schema + GRANTs + RLS + policies).
2. Server functions.
3. UI (list → detail → forms).
4. Wire navigation + role gating.
5. Verify with a quick Playwright smoke pass on the new pages.

I'll check in after each phase so you can review before moving to the next.
