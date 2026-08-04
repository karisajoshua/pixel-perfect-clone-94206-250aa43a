# Fix the date shifting on downloaded invoices and receipts

## What's wrong
Invoice and receipt dates are stored as plain calendar dates (e.g. `2026-08-04`), but the PDF generators convert them with `new Date("2026-08-04")`. JavaScript reads that string as midnight **UTC**, then prints it in the viewer's local time zone. Any device behind UTC renders the previous day, so the downloaded PDF shows a date one day off from what was selected.

Confirmed in:
- `src/lib/invoice-pdf.ts` — `fmtDate()` (issue date, due date, payment rows)
- `src/lib/receipt-pdf.ts` — payment date line and the receipt-number year

## Fix
Parse calendar dates as local dates instead of UTC:

- Add a small shared date helper that splits a `YYYY-MM-DD` string into year/month/day and builds a local `Date`, falling back to normal parsing for full timestamps.
- Use it in `src/lib/invoice-pdf.ts` for the issue date, due date, and each payment row.
- Use it in `src/lib/receipt-pdf.ts` for the payment date and the year used in the receipt number.
- Formatting style stays exactly as it is today ("04 Aug 2026" on invoices, "04 August 2026" on receipts).

No database, form, or business-logic changes — the stored values are already correct; only the display conversion is wrong.

## QA
Generate an invoice PDF and a receipt PDF with the browser time zone set behind UTC and confirm the printed dates match the dates selected in the form.
