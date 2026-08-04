# Add "Elizabeth Grace" above "Authorized Signatory" on receipts

## What changes

In `src/lib/receipt-pdf.ts` (line 305), the Authorized By panel currently prints the `receivedBy` value above "Authorized Signatory". Replace it with the hardcoded name **Elizabeth Grace** so every receipt shows that name regardless of who recorded the payment.

## Details

- Line 305: change `doc.text(receivedBy || "", ...)` → `doc.text("Elizabeth Grace", ...)`
- No other layout changes needed; the name sits on the signature line directly above "Authorized Signatory".
