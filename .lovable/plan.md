# Track partial payments with a running balance

## The problem today

The data is correct — invoices and their part payments exist (for example NANCY NJOKI KARANJA's invoice INV-1786950744593: total 10,500, two M-Pesa payments of 3,500 on 4 May and 4 Jun, balance 3,500). What is missing is where you can see it:

- The client page has only Overview, Vehicles, KYC and Documents — no billing view, so from the client you cannot see what was invoiced or paid.
- A cover's payments are matched only to invoices whose policy is that exact record. Instalment and ROP covers are separate policy records with no invoice of their own, so they show no payments and a stale balance (e.g. ARON's ROP shows "paid" with a 10,500 balance, MARIA's 2nd instalment shows 10,085 outstanding while the money sits on the first cover's invoice).
- The payment list on an invoice shows each payment as a flat line — no running balance after each one.

## What will change

### 1. Payment history with running balance
On the invoice page, the Payments block becomes a proper statement, ordered oldest to newest:

```text
Date        Method / Reference        Amount      Paid to date   Balance
04 May 26   M-Pesa · UCEB09FXKC        3,500          3,500       7,000
04 Jun 26   M-Pesa · UCEB09FXKC        3,500          7,000       3,500
                                                   Outstanding    3,500
```

Each row keeps its receipt download and (admin/manager) delete action. Deleting recalculates the whole statement.

### 2. Billing tab on the client page
A new **Billing** tab listing every invoice for that client — number, linked cover, issue date, total, paid, balance, status — expandable to the same payment statement, with links to open the invoice and download receipts. A summary strip shows total billed, total paid and total outstanding for the client.

### 3. Cover payments follow the instalment chain
A cover's paid amount and balance are resolved across its whole chain (original cover → 2nd instalment → ROP), so payments recorded on the first invoice show on every cover in that chain instead of vanishing. The policy page gains the same payment statement, and the vehicle cover card shows "Paid X of Y · balance Z".

### 4. Repair the out-of-step covers
A one-off data correction recomputes `payment_status` and `balance_due` for every cover from what has actually been paid across its chain, fixing the records that currently say "paid" while carrying a balance, and vice versa.

## Technical notes

- New `src/components/payments/payment-statement.tsx` — shared table computing the running balance from payments sorted by `paid_date` then `created_at`.
- `src/routes/_authenticated/invoices.$id.tsx` — replace the payments list with the statement component.
- New `src/components/clients/client-billing.tsx` + a Billing tab in `src/routes/_authenticated/clients.$id.tsx`, querying invoices with `invoice_items` and `payments` for the client.
- New helper in `src/lib/policy-balance.ts` (or a sibling) to walk `previous_policy_id` / `rop_of_policy_id` in both directions and collect all invoices for the chain; used by `policies.$id.tsx`, `client-vehicles.tsx` and the policies list.
- `src/lib/policy-payment-sync.ts` — sync against chain invoices rather than only invoices whose `policy_id` equals the policy.
- Backfill: a data update over `policies` joined to chain invoices and payments to reset `payment_status` and `balance_due`. No schema change needed.
