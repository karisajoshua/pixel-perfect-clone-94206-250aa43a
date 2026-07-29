# Invoice redesign + scannable verification QR

## What changes

The downloadable invoice PDF is restyled to match the attached design, and every invoice gains a QR code anyone can scan to confirm it is genuine.

### New invoice look
- Rounded blue header band: logo, agency name and tagline on the left; a vertical divider, then "INVOICE", the invoice number, a status pill (PAID / PARTIAL / UNPAID) and the QR code with the caption "Scan to verify invoice authenticity" on the right.
- FROM / BILL TO as two columns split by a thin vertical rule, with small icons for location, phone, email, person and policy.
- A light grey stats strip with four cells: Issue date, Due date, Status (coloured pill), Balance — dates formatted like "10 Jul 2026".
- Blue table header for line items; totals block right-aligned underneath, with a highlighted "BALANCE DUE" row.
- "PAYMENTS RECEIVED" table below when payments exist.
- Footer: thank-you note and generation date, then a divider and a contact row (country, phone, email) plus "Powered by Texcortech Systems" on the right.

### Verification QR
- The QR encodes a public link: `https://<site>/verify/invoice/<invoice id>`.
- A new public verification page shows: invoice number, agency name, client name, issue/due dates, total, amount paid, balance and status — plus a clear "Verified — issued by <agency>" banner. Unknown IDs show "No invoice found for this code."
- Only those non-sensitive fields are exposed; no line items, contacts, payments or internal IDs.

## Technical notes
- Add the `qrcode` package; generate a data-URL QR in `src/lib/invoice-pdf.ts` and place it with `doc.addImage`.
- Rewrite the layout in `src/lib/invoice-pdf.ts` (jsPDF + autotable): helpers for the rounded header band, status pills, the four-cell stats strip and the totals block. Keep `getCurrentBrand()` tokens so tenant colours still apply (the blue in the mock is the brand primary).
- New public route `src/routes/verify/invoice.$id.tsx` (outside `_authenticated`) calling a new server function backed by a `security definer` SQL function `public.verify_invoice(uuid)` that returns only the whitelisted columns and is executable by `anon`. No table grants widened.
- Receipt PDF is left unchanged.