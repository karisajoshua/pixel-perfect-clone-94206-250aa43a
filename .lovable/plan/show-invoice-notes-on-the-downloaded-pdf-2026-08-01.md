# Show invoice notes on the downloaded PDF

## Problem
Notes typed in the invoice form are saved to the database, but the PDF generator never draws them — it renders header, parties, stats strip, line items, totals, payments, then the footer. So a downloaded invoice shows no notes.

## Fix
Add a "NOTES" block to the invoice PDF, rendered after the payments table and before the footer:

- Only render when the invoice has non-empty notes.
- Section label "NOTES" in the brand colour, matching the existing "PAYMENTS RECEIVED" heading style.
- Body text in muted grey, wrapped to the page width with `doc.splitTextToSize` so long notes don't run off the page.
- Light rounded panel behind the text for visual consistency with the stats strip.
- If the block would collide with the footer area, add a new page first and continue there.

## Technical detail
Single-file change in `src/lib/invoice-pdf.ts`. The `invoice` object already carries `notes` from every caller (invoice list, invoice detail, portal invoice detail), so no call-site or data changes are needed.

QA: generate a PDF with a long multi-line note and confirm wrapping, spacing, and no overlap with the footer.
