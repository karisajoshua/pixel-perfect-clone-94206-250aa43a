# New invoice number format

Change invoice numbers to `INV` + year + month + agency code + sequence, e.g. `INV202609ZIA001`, and renumber every existing invoice to match.

## Format rules

- `INV` + 4-digit year + 2-digit month (from the invoice's issue date) + agency code + 3-digit (or longer) sequence.
- The sequence never restarts: it keeps counting up per agency, across months and years.
- Each agency gets its own code. Zest = `ZIA`. New agencies get a code auto-derived from their name, editable in agency settings so it can be corrected.

## What changes

1. **Agency code** — add an invoice code field on each agency, set to `ZIA` for Zest and a derived 3-letter code for the others, and expose it as an editable field in agency settings.
2. **Number generation** — new invoices get their number from the database at save time instead of the current timestamp placeholder, so two people saving at once can never land on the same number. The number field in the New invoice box shows as auto-assigned (read-only for new invoices).
3. **Renumbering existing invoices** — every existing invoice is renumbered in the order it was issued (issue date, then creation time) within each agency, so the oldest invoice becomes `...001`, the next `...002`, and so on, with the year/month taken from each invoice's own issue date.
4. **Everywhere the number shows** — invoice list, invoice detail, PDF invoices, receipts, client billing, portal, and verification page all read the stored number, so they pick up the new format automatically. Emails already sent keep their old text; nothing is re-sent.

## Technical notes

- Migration: add `tenants.invoice_code text`, a sequence counter column/table per tenant, and a `SECURITY DEFINER` function `next_invoice_no(tenant_id)` that atomically increments and returns the formatted number. Grants for `authenticated` + `service_role`.
- Backfill runs as a data update (not part of the schema migration): ordered `ROW_NUMBER()` per tenant over `(issue_date, created_at)`, writing `INV` || `to_char(issue_date,'YYYYMM')` || code || `lpad(seq,3,'0')`, then setting each tenant's counter to its max used sequence.
- `invoice_no` keeps its uniqueness constraint; backfill is done in one statement so no duplicates occur mid-way.
- `src/components/invoices/invoice-form-dialog.tsx`: drop `INV-${Date.now()}`; call the generator on insert and display the returned number.
- `src/routes/_authenticated/admin.import.tsx` bulk import switches to the same generator instead of `INV-${stamp}-${seq}`.

## Note

Old invoice PDFs already downloaded or emailed still show the previous numbers; the system and any newly generated PDFs will show the new ones.
