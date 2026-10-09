# Client, Policy and Billing Operations

Source review: 10 October 2026. These are code observations, not production test results.

## Clients
The clients page at `src/routes/_authenticated/clients.tsx` permits admin, manager and agent roles. It displays client names, company details, contact information and KYC status, with server-side pagination (15 records per page). It includes client creation/editing, an export dialog, and an administrative deletion flow using `deleteClient`.

## Policies
The policies page at `src/routes/_authenticated/policies.tsx` permits admin, manager and agent roles. It lists policy and certificate numbers, policy status, payment status, dates, gross premium, instalment plan, balance, client, insurer and vehicle. Search and filters are provided; list queries are limited to 200 records. A policy form is present.

## Invoices
The invoices page at `src/routes/_authenticated/invoices.tsx` permits admin, manager and agent roles. It lists invoice status, dates, total and paid amount, and supports an invoice form and PDF generation. The PDF query joins invoice items, payments, policy, client and branch data. The UI limits deletion controls to admin/manager, but server-side enforcement has not been validated.

## Verification checklist
- Test record ownership and cross-agency isolation on reads, writes, exports and deletes.
- Verify invoice balances, payment reconciliation and audit history.
- Test policy creation, issuance and certificate handling end to end.
- Confirm server functions independently enforce permissions.
- Validate pagination, PDF confidentiality and deletion retention rules.
