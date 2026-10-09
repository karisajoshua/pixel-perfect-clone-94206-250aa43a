# Zest Insurance — Administrator Operations Manual

**Edition:** Phase 3, 10 October 2026. Source-based; operational steps require staging validation.

## 1. Administrator responsibilities
Agency administrators manage staff access, insurer and branch configuration, communication channels, integration settings and operational controls. A separate super-administrator area handles platform-wide agencies, notices, messaging health and audit views.

## 2. Staff accounts and roles
**Route:** `/admin/users`. The source restricts this route to admin. It exposes invitation, profile update and deletion server functions. Available UI role labels are `admin`, `manager`, `agent`, `viewer` and `client`.

**Procedure:** verify a staff member's identity and agency; select least-privilege role; invite or edit; confirm the change using a test account; record approval. Before deleting an account, review ownership of open claims, policies and scheduled jobs. Verify server-side checks in `src/lib/admin-users.functions.ts`.

## 3. Agency settings
The route registry includes branches, insurers, security, sessions, notifications, audit, imports and documentation. Review each setting in staging before changing live configuration. Protect service credentials and avoid pasting them into support tickets.

## 4. DMVIC administration
**Route:** `/admin/dmvic`; admin only in route source. The screen references connection status, certificate orders, price tables, motor insurer rates, agency verification information and settlements. Validate insurer membership IDs, rate approvals, order state and settlement reconciliation with provider evidence.

## 5. IPEN administration
**Route:** `/admin/ipen`; admin, manager and agent in route source. The interface includes connection, MFA, provider data lookups, policies, claims, OCR and M-Pesa actions. Review whether each privileged operation should be limited further. Do not test live payments with real customer funds without an approved test plan.

## 6. WhatsApp administration
**Route:** `/admin/whatsapp`; admin and manager in route source. Configure channel details, inspect connection status, manage templates, review consent and run controlled test sends. The public webhook verifies Meta signatures in source. Confirm approved templates, delivery receipts, consent evidence and per-agency separation.

## 7. Email and renewals
Review transactional email and queue administration, sender authentication, suppression and unsubscribe handling. Renewal reminders are defined for 60, 30, 14, 7 and 1 days before expiry using Nairobi business dates. Confirm scheduler registration, deduplication and actual delivery before announcing reminders as active.

## 8. Automation operations
The automation engine processes queued events and jobs with retries. Confirm job ownership, idempotency, failed-job alerts, maximum execution times and tenant isolation. Do not manually rerun a payment-related job without reconciliation.

## 9. Platform super-admin
**Routes:** `/platform`, `/platform/agencies`, `/platform/notices`, `/platform/whatsapp`, `/platform/audit`. The platform layout checks for `super_admin`. Treat this as privileged cross-agency access; verify auditability and enforce separate approval for high-risk actions.

## 10. Daily operating checklist
Review integration failures, unprocessed callbacks, messaging delivery, renewal queues, audit exceptions, backups and active incidents. Reconcile financial exceptions before issuing certificates or changing invoice states.

## 11. Incident handling
Record incident start, affected tenants, user impact, suspected cause and actions. Restrict affected credentials, preserve audit evidence, assess customer notification obligations and use documented rollback procedures. Never share sensitive customer records in public issues.

## 12. Evidence and screenshots
Capture approved staging screenshots of user management, integration status, templates, settlement views, automation queues and platform audit. Use synthetic records and redact all secrets. No screenshots have yet been captured for this manual.
