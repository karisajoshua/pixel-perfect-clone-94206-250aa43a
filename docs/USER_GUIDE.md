# Zest Insurance — Agency Staff User Manual

**Edition:** Phase 3, 10 October 2026. **Scope:** source-based walkthrough, not a live UI acceptance test. Screenshots are pending an authorised test deployment.

## 1. Sign in and account access
Open the application sign-in screen. The source supports sign-in, password recovery and TOTP multifactor verification. Depending on account roles and agency membership, users may be directed to the dashboard, customer portal or onboarding. If a required second factor has not been satisfied, the agency layout redirects to sign-in.

## 2. Find your way around
The staff shell in `src/components/app-shell.tsx` builds navigation by role. Agency users can see dashboard and, where permitted, clients, quotations, policies, claims, invoices, renewals, reports and administration. Navigation visibility is not proof of server-side permissions.

## 3. Manage a client
**Route:** `/clients`. Staff with admin, manager or agent roles can open the client list. Use search to locate a customer by name, company or email. The page fetches 15 records at a time. Select a client for details, or open the client form to add a record. Admin/manager users may see an export action; deletion is restricted to admin in the UI. Confirm KYC and identity data before using it in policy documents.

## 4. Prepare a quotation
**Route:** `/quotations`. Open the quotation form and select the appropriate client, insurer, product class and risk details. The source includes premium-calculation helpers and a quotation PDF action. Admin/manager users have an approval-related UI capability. A conversion handler creates a policy record from a quotation; verify authorisation, payment and insurer confirmation before treating the cover as bound.

## 5. Manage policies
**Route:** `/policies`. Search by policy or certificate number; use the available status and policy-term filters. Records show policy and certificate identifiers, dates, premium, payment status and balance. The page includes a New policy form. **Creating a database record does not itself prove an insurer-issued certificate.**

## 6. Register and track a claim
**Route:** `/claims`. Select New claim and record the incident details against the correct client and policy. The interface tracks reported, under_review, approved, rejected, settled and closed states. An IPEN claim filing dialog is referenced. Do not promise settlement until insurer confirmation and financial reconciliation are recorded.

## 7. Manage invoices
**Route:** `/invoices`. View invoice number, issue and due dates, total and amount paid. Create an invoice using the form and download a PDF where available. Deletion is a sensitive operation; consult an administrator and retain required accounting evidence.

## 8. Follow up renewals
**Route:** `/renewals`. Filter overdue/due today, due in seven days, due in 30 days or due in 31–60 days. Verify the policyholder contact details and renewal terms before communication. Automated reminders are a separate workflow and must not be assumed delivered.

## 9. Use the AI assistant
The assistant can answer questions and provide workflow guidance. Independently verify coverage, premium calculations, payment status and claims outcomes. Never paste unnecessary customer personal data into prompts.

## 10. Customer self-service
The separate customer portal includes policy, claim, invoice, document, vehicle and profile routes. Only the signed-in customer's authorised records should be accessible; this requires database-level verification.

## Support and troubleshooting
- **Access denied:** confirm your role and agency membership with an administrator.
- **Missing data:** verify search criteria and selected agency; do not bypass access restrictions.
- **Payment not reflected:** reconcile with provider records before changing payment state.
- **Message not received:** check consent, suppression and queue status with an administrator.

## Screenshot capture plan
Capture synthetic-data screenshots for sign-in, dashboard, clients, quotation form, policy list, claim form, invoice PDF, renewals and customer portal. Redact customer names, contacts, payment identifiers and access tokens. Store approved images under `docs/assets/screenshots/` and reference them from this guide. **No screenshots are included until captured and approved.**
