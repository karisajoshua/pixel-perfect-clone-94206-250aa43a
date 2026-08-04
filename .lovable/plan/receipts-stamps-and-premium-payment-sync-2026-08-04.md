# Receipts, stamps and premium/payment sync

## 1. Delete a receipt

On the invoice page, each recorded payment gets a delete action (admin/manager only) with a confirmation dialog. Deleting a payment:
- removes the payment record,
- recalculates the invoice's paid amount and status (paid / partial / unpaid) from the remaining payments,
- re-syncs the linked policy's payment status and balance (see section 3).

Staff already have permission to delete payments, so no access-rule change is needed.

## 2. Stamp missing on receipts

The receipt already prints the agency stamp in the "Authorized by" panel, but no agency in the system currently has a stamp image saved — that is why the area comes out blank.

Plan:
- When no stamp is uploaded, show a clear "No company stamp uploaded" hint in that panel instead of empty white space.
- Add a visible prompt in Agency settings pointing to Admin → Agency → Company stamp.
- Also print the stamp on the invoice PDF, which currently never shows one.

Once your stamp is uploaded under Admin → Agency, it appears on quotations, invoices and receipts.

## 3. Premium blank and payment status stuck on "unpaid"

Two separate gaps:

a) Covers added from the Vehicles tab ("Add cover") capture only policy number, certificate, dates, insurer and term — there is no premium field, so the policy is saved with no premium. 142 of 147 active policies currently have no premium, which is why the dashboard's "Active cover premium" reads near zero while Total revenue (paid) is correct (revenue comes from payments, premium from the policy).

Fix: add Premium (KES), Payment status and Balance due to the cover section of the vehicle form, so staff can enter or correct the premium when adding or editing a vehicle's cover.

b) Recording a payment on an invoice updates only the invoice — nothing writes back to the policy the invoice belongs to, so the vehicle cover card keeps showing "unpaid".

Fix: after a payment is recorded (or deleted), update the linked policy:
- payment status = paid when the invoice is fully settled, partial when part-paid, unpaid when nothing is paid,
- balance due = remaining invoice balance,
- if the policy has no premium yet, set it from the invoice total so the dashboard picks it up.

## 4. Backfill

One-off data update for existing records: for every policy that has an invoice, set the policy's premium (when empty) from the invoice total, and set payment status and balance due from what has actually been paid. The dashboard's Active cover premium then reflects real figures without re-entering anything.

## Technical notes

- `src/routes/_authenticated/invoices.$id.tsx` — delete-payment action, recompute invoice totals, call the new sync helper after add/delete.
- New `src/lib/policy-payment-sync.ts` — recompute policy `payment_status`, `balance_due`, and fill `premium_gross` from invoice totals.
- `src/components/vehicles/vehicle-form-dialog.tsx` — premium / payment status / balance fields in the cover block, included in insert and update payloads.
- `src/lib/receipt-pdf.ts` and `src/lib/invoice-pdf.ts` — stamp fallback text; add a stamp block to the invoice.
- Backfill as a data update over `policies` joined to `invoices` and `payments`.