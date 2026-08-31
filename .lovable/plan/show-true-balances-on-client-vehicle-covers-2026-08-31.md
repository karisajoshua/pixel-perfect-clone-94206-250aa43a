# Show true balances on client vehicle covers

## Goal
On a client's **Vehicles** tab, every cover must reflect what has actually been paid across its installment chain — a partially paid cover must never render as "Paid in full", and the balance must be visible at a glance, matching what the Billing tab shows.

## What I found
- The per-cover cards already compute chain-aware balances, **but** `policyBalance()` (src/lib/policy-balance.ts) short-circuits whenever the stored `payment_status` is `paid` — even if `balance_due` is still positive. Verified live data: policy `DA/047/3617/256278/2026 JANE-ROP` is stored as `paid` with `balance_due = 6,000` and no invoice, so it displays "Paid in full".
- The highlighted **"Active cover / Latest cover"** summary box at the top of each vehicle card shows only policy no., certificate, commencing and expiry — no premium, paid or balance. For split (installment) covers this is the first thing staff see, and it carries no money information.
- Manually created/edited covers (policy form, imports) can carry a `paid` status that was never reconciled against invoices.

## Changes

### 1. Make the numbers win over the status label (`src/lib/policy-balance.ts`)
- Remove the blind `payment_status === "paid"` short-circuit.
- Compute the balance from the figures: stored `balance_due` when present, else `premium_gross − chain paid`.
- A cover is only "Paid in full" when the computed balance is ≤ 0; if the stored status says `paid` but the computed balance is positive, show the balance and mark the status chip as inconsistent.

### 2. Add money to the vehicle "Active/Latest cover" summary box (`src/components/clients/client-vehicles.tsx`)
- Extend the summary box with **Premium**, **Paid**, and **Balance due** (chain-aware, via the existing `paidByPolicy` map).
- Add the same progress line used on cover cards: `Paid KES x of KES y · balance KES z` in red when outstanding, `Paid in full` in green otherwise.
- When the shown cover is part of an installment chain with an outstanding balance, show a small amber chip: "Installment balance KES z".

### 3. Cover cards: surface status/figure mismatch
- If stored `payment_status` disagrees with the computed balance (e.g. says `paid` but balance > 0, or says `unpaid` but fully paid), show a subtle "status out of sync" hint next to the Payment value so staff know to record/invoice the payment.

### 4. One-time data repair (SQL)
- Recompute `payment_status` and `balance_due` for every policy that has invoices, using chain totals (billed vs paid across the installment chain), same rules as `syncPolicyFromInvoice`.
- For policies with **no** invoices and a `paid` status but positive `balance_due` (like the JANE-ROP row), reset `payment_status` to `partial` so the balance shows; these are flagged in the migration output for staff review.

### 5. Guard the manual policy form (`src/components/policies/policy-form-dialog.tsx`)
- When staff pick `payment_status = paid` but a positive balance is entered/known, warn and require the balance to be cleared first (soft warning, not a hard block).

## Verification
- Open Sarah Wanjiru Maina (partial installment) — Vehicles tab shows balance in both the summary box and cover card.
- Open Jane Ndunge Kitivo — cover no longer shows "Paid in full"; KES 6,000 balance visible.
- Record a partial payment on an invoice and confirm the Vehicles tab updates without reload (existing invalidation).
- Typecheck + build.
