# Cover balances update the moment a payment is recorded

## The gap today

Cover cards on the client page already show **Paid** and **Balance due** (chain-aware, so instalments and ROP share the money). But when staff record or delete a payment on the invoice page, only the invoice and dashboard views refresh — the client's covers, the policies list, the policy detail page and the Billing tab keep showing the old balance until someone reloads the page.

## What will change

### 1. Payment recording refreshes every balance view
After a payment is recorded, edited or deleted, the app immediately refreshes:
- The client's **cover cards** (Paid / Balance due under Vehicles)
- The client's **Billing tab** (totals and the payment ledger)
- The **policies list** and the **policy detail page** (balance chip + statement)
- The **dashboard** figures

So staff can record a part payment, open the client, and see the new balance on the cover straight away — no reload.

### 2. "Paid X of Y · balance Z" on every cover
Each cover card gains a one-line progress summary under the payment details, e.g. *"Paid KES 7,000 of KES 10,500 · balance KES 3,500"*, computed from the whole instalment chain. Fully paid covers show *"Paid in full"*; covers with no premium set keep the existing "add the premium" prompt.

## Technical notes

- Add a small helper `invalidatePaymentViews(qc)` (in `src/lib/policy-payment-sync.ts` or a new `src/lib/invalidate.ts`) that invalidates the query keys: `client-vehicles`, `client-billing`, `policies`, `policy`, `policy-chain-invoices`, `invoice`, `invoices`, `dashboard`, `renewals`.
- Call it in `src/routes/_authenticated/invoices.$id.tsx` after `PaymentDialog` save and after payment delete (replaces the current three-key invalidation).
- In `src/components/clients/client-vehicles.tsx`, add the progress line inside each cover block using the already-fetched `paidByPolicy` and `policyBalance()` — no new queries.
- No schema or data changes.
