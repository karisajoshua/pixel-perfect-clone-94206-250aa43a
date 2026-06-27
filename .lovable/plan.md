## Goal

Whenever a payment is recorded against an invoice (partial or full), give staff and clients a downloadable **Receipt PDF** styled like the attached Texcortech receipt but with Zest branding (logo, blue header, Ruai address, +254 713 985 230, info@zestinsurance.co.ke, stamp, footer).

## What gets built

### 1. New PDF generator — `src/lib/receipt-pdf.ts`
Mirrors the structure of `invoice-pdf.ts` but matches the attached layout:
- Top: Zest logo (left) + contact block (right): phone, email, website, Nairobi
- Centered **RECEIPT** title with `Receipt No.` (format `RCP-YYYY-NNNN`, derived from payment id/sequence) and date
- **RECEIVED FROM** block: client name, phone, email, branch
- **AMOUNT RECEIVED**: big number + amount-in-words (Kenya Shillings …) + "PAID IN FULL" / "PARTIAL PAYMENT" tag based on remaining balance
- **PAYMENT DETAILS**: method, reference, paid date, related invoice no. + policy no.
- **PAYMENT SUMMARY** table: Invoice total, Previously paid, This payment, Total paid to date, Balance
- **RECEIVED BY**: name of staff who recorded the payment (from `profiles`)
- Terms & conditions block (same 4 bullets, adapted wording)
- Zest stamp image bottom-right
- Footer: address + agency contact + "Powered by Texcortech Systems"

Helper `numberToKesWords(n)` for the "Kenya Shillings … Only" line.

### 2. Receipt number
No schema change. Derive deterministically: `RCP-{year}-{zero-padded sequence within the year}` using count of payments in the same calendar year up to and including this payment's `paid_date`. Computed at render time.

### 3. Download buttons
Add a **Download receipt** action next to each payment row in:
- `src/routes/_authenticated/invoices.$id.tsx` (payments list — staff)
- `src/routes/_portal/portal/invoices.$id.tsx` (payments list — client portal)

Wires payment + invoice + client + branch into `downloadReceiptPdf(...)`.

### 4. Auto-email receipt on payment (optional, included)
Reuse the existing `payment-receipt` email template registry entry. When a payment is created in `invoice-form-dialog.tsx` (and the API path that records payments), trigger `sendTransactionalEmail({ templateName: "payment-receipt", ... })` to the client's email if present. Idempotency key = payment id. No new infra — uses the existing transactional send route.

## Out of scope
- No schema change (no `receipts` table — receipt is derived from `payments` + `invoices`).
- No bulk re-issue of receipts for historical payments (download button works for them on-demand).

## Files touched
- **Add** `src/lib/receipt-pdf.ts`
- **Edit** `src/routes/_authenticated/invoices.$id.tsx` — add Download receipt button per payment
- **Edit** `src/routes/_portal/portal/invoices.$id.tsx` — add Download receipt button per payment
- **Edit** `src/components/invoices/invoice-form-dialog.tsx` — after recording a payment, fire transactional email
