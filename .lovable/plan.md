## Goal
On the invoice detail page, add a **Download PDF** button that produces a branded Zest Insurance Agency invoice. Available to anyone with read access to the invoice (admins, branch staff, and the client via the portal) — RLS already gates this, so we don't need a separate role check.

## What you'll see
- A **Download PDF** button next to "Record payment" / "Edit" on `/_authenticated/invoices/$id`.
- The same button on the client-portal view `/_authenticated/portal/invoices/$id`.
- Clicking it generates a PDF in the browser and triggers a save as `Invoice-<invoice_no>.pdf`.

## PDF layout (single page, A4)
- **Header band** with the Zest red brand color, the Zia logo (from the existing asset), and the agency name "Zest Insurance Agency".
- **Branch block** (left): branch name, address, phone, email — pulled from the invoice's branch.
- **Invoice meta block** (right): "INVOICE", invoice number, issue date, due date, status badge (Paid / Partial / Pending / Overdue).
- **Bill-to block**: client name (company name for corporate clients) and policy number if linked.
- **Line items table**: Description · Qty · Unit price · Total. Zebra rows, branded header row.
- **Totals**: Subtotal, Tax, Total, Amount paid, Balance due (balance highlighted).
- **Payments mini-table** (only if payments exist): date, method, reference, amount.
- **Footer**: thank-you line + "Generated on <date>" — kept compact.

## Implementation
1. Add `jspdf` + `jspdf-autotable` via `bun add` (small, browser-only, no native deps).
2. New helper `src/lib/invoice-pdf.ts` exporting `downloadInvoicePdf(invoice, branch, client, policy, payments, items)`:
   - Builds the layout above with jsPDF + autoTable.
   - Inlines the Zia logo by fetching the asset URL and embedding it as a data URL.
   - Uses the brand red (`#dc2626` family — matches the existing logo file name) for the header band and accent rules.
3. Update `src/routes/_authenticated/invoices.$id.tsx`:
   - Extend the existing `useQuery` select to also pull `branches(name, address, phone, email)`.
   - Add a `Download PDF` button (with `Download` icon) that calls the helper using current query data.
4. Update `src/routes/_authenticated/portal/invoices.$id.tsx` similarly so portal users can download their own invoice PDF.
5. No DB / RLS / migration changes needed — `invoices` and `branches` are already readable through existing policies for both staff and the linked client.

## Out of scope
- Server-rendered PDFs (kept client-side for simplicity and zero infra cost).
- Email-the-invoice flow (separate request).
- Per-branch logo overrides (uses the single agency logo).
