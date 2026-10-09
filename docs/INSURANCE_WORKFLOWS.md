# Insurance workflows — source-verified review

Reviewed: 2026-10-10. Source observations are **not** end-to-end test results.

## Quotations
**Source:** `src/routes/_authenticated/quotations.tsx`. Route requires admin, manager or agent. It reads `quotations` with related clients, insurers and vehicles, includes quotation PDF download, premium calculation helpers, and a `convert` handler that inserts a policy. Conversion calculates an end date from `policy_term` (including annual, six-month and other terms).

**Verify before use:** approval controls, quotation-to-policy transactionality, numbering collisions, insurer rating correctness, and prevention of duplicate conversions. The UI's `canApprove` logic must not substitute for database authorization.

## Claims
**Source:** `src/routes/_authenticated/claims.tsx`. Route requires admin, manager or agent. Reads `claims` with linked client, policy and vehicle; provides create/edit dialog and statuses `reported`, `under_review`, `approved`, `rejected`, `settled`, `closed`. References an IPEN claim filing dialog.

**Verify:** valid state transitions, attachments, financial approvals, claims audit history and external filing acknowledgements.

## Renewals
**Source:** `src/routes/_authenticated/renewals.tsx`. Queries policies with statuses active/pending/expired and expiry dates within 60 days; identifies superseded policies via `previous_policy_id`. UI supports overdue/due-today, 7-day, 30-day and 31–60-day filters.

**Verify:** pagination beyond 5,000 rows, date/time handling, supersession edge cases, reminder deduplication and whether actual policy renewal requires separate steps.

## Other workflows
Dedicated routes exist for policies, invoices, clients, reports and the customer portal. Detailed transaction sequences remain **unverified** pending inspection of handlers and database policies.

## Acceptance test examples
1. Create quotation as agent; ensure another tenant cannot view it.
2. Approve/convert quote once; ensure duplicate requests cannot create duplicate policies.
3. Report claim; validate permitted status transitions and audit trail.
4. Create renewal; verify prior policy link and reminder behavior.
5. Reconcile paid invoice and related financial entries against provider records.
