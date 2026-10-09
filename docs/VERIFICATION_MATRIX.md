# Phase 2 Verification Matrix

This is a source review register, not a production certification.

| Capability | Evidence inspected | Still to validate |
| --- | --- | --- |
| Clients | Listing, pagination, forms, export and delete controls | Authorization, retention, tenant isolation |
| Policies | Listing, balances and policy form | Issuance and lifecycle transitions |
| Quotations | Premium helpers and conversion handler | Approvals, duplicate prevention and pricing |
| Claims | Statuses and filing UI | State transitions, attachments and insurer acknowledgement |
| Invoices | Listing, PDF and deletion flow | Reconciliation, deletion permissions and audit |
| Renewals | Expiry filters and predecessor links | Duplicate prevention and large data sets |
| Renewal emails | Scheduled hook and Nairobi business dates | Live schedule, suppression and delivery |
| Automation | Event and job processing engine | Retry and locking behavior under concurrency |
| DMVIC | Administration, rates and settlement views | Provider connectivity and certificate issuance |
| IPEN / M-Pesa | Administration and callback handlers | Provider authenticity and payment reconciliation |
| WhatsApp | Channel UI and webhook verification | Consent, templates and provider delivery |
| AI assistant | IPEN function and in-app chat tools | Tool authorization, privacy and injection resilience |
| Customer portal | Role gate and route inventory | Per-customer record ownership |
| Platform administration | Super-admin route gate | Cross-agency privilege enforcement |

## Verification standard
Mark a feature verified only after reproducible tests using synthetic data, cross-tenant access checks, error and retry tests, and provider sandbox results where applicable. Record the reviewer, date, commit and test evidence.
