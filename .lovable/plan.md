
## PRD Module Audit

| # | PRD Module | Status |
|---|---|---|
| 4.1 | Client Management | ✅ Built (clients list/detail, KYC, communications log) |
| 4.2 | Vehicle Management | ✅ Built (registration, logbook upload, policy history) — ⚠️ no inspection scheduling record |
| 4.3 | Document Management | ✅ Built (client-documents + agency-documents buckets, KYC tracking) |
| 4.4 | Policy Management | ✅ Built (lifecycle, statuses, expiry views) |
| 4.5 | Renewal Reminders | ⚠️ Partial — email cron live, **SMS & WhatsApp not wired** |
| 4.6 | Quotation Management | ⚠️ Partial — schema + CRUD live, **no manager approval workflow / revision tracking** |
| 4.7 | Invoice & Billing | ✅ Built (issue, payments, reports) |
| 4.8 | Claims Management | ⚠️ Partial — base table + portal report, **missing structured uploads: police abstract, driver license, national ID, accident statement, accident sketch; multi-vehicle/third-party** |
| 4.9 | Self-Service Portal | ⚠️ Partial — view policies/invoices/claims live, **no "request renewal" / "request cancellation" actions** |
| 4.10 | User & Branch Management | ✅ Built (roles, branch scoping, admin users page) |
| 4.11 | Reporting & Analytics | ✅ Built (reports.tsx covers expiring, revenue, branch, staff, insurer, claims-vs-revenue) |
| 4.12 | Security & Access Control | ⚠️ Partial — RLS, audit log, HTTPS in place; **no 2FA toggle for admins** |
| 4.13 | Mobile & Remote Access | ✅ Responsive shell |
| 4.14 | Training & Support | ✅ Help panel + admin.docs + AI assistant |

## What I'll Build

**1. Claims — structured incident capture**
- Migration: add `third_party_details jsonb`, `accident_statement text`, expand claims storage path `claim-documents/{claim_id}/{abstract|sketch|driver_license|national_id|other}`.
- New `claims.$id.tsx` detail page with tabbed sections: Incident, Documents (categorised uploads with preview), Third-party vehicles (add/remove rows), Status timeline.
- Portal claim form: add file upload + statement + sketch.

**2. Renewal reminders — SMS & WhatsApp channels**
- Add `SMS_PROVIDER_API_KEY` & `WHATSAPP_API_TOKEN` secrets (ask user; skip sending if missing).
- Extend `routes/api/public/hooks/renewal-reminders.ts` to enqueue one notification per channel (email + sms + whatsapp) when client has phone.
- New server functions `sendSms` / `sendWhatsApp` using Africa's Talking and WhatsApp Cloud API; admin notifications page shows per-channel delivery status.
- Admin → Notifications: filter by channel + manual resend.

**3. Quotation approval workflow**
- Migration: add `approval_required bool`, `approved_by uuid`, `approved_at timestamptz`, `revision int`, `parent_quote_id uuid` on `quotations`.
- Statuses: `draft → pending_approval → approved → sent → accepted/rejected/expired → converted`.
- New `quotations.$id.tsx`: agent submits for approval; manager/admin can approve/reject with note; "Revise" clones into new revision linked to parent.

**4. Self-service portal actions**
- New table `service_requests` (`type: renewal|cancellation|info`, `policy_id`, `reason`, `preferred_contact`, `status`).
- Portal: "Request Renewal" / "Request Cancellation" buttons on policy detail → opens dialog → creates request + queues internal email to assigned agent.
- Staff inbox surfaced in dashboard.

**5. Admin 2FA**
- Use Supabase Auth MFA (TOTP). Add `/admin/security` page where admin users can enrol/unenrol an authenticator and view factor status.

**6. Vehicle inspection scheduling (small)**
- Add `next_inspection_date` to `vehicles`; surface in vehicles list + dashboard "Inspections due" widget.

## Out of Scope (already adequate)
- Cloud hosting, backups, encryption-at-rest (managed by Lovable Cloud).
- Branded PDFs (already in `invoice-pdf.ts`, `quotation-pdf.ts`).

## Notes
- SMS/WhatsApp will fail gracefully without provider keys — I'll ask for them before enabling those channels in production.
- Each new table follows the standard pattern: GRANT → RLS enable → policies scoped by branch / role / `current_client_id()`.
