## Changes to `src/lib/quotation-pdf.ts`

### 1. Fix totals row alignment
Current totals row uses `colSpan: 3` then 3 value cells — that shifts Premium/Levies/Total into the wrong columns (Rate %/Premium/Levies). Change to `colSpan: 4` covering Class + Benefits + Sum insured + Rate %, then the 3 value cells land correctly under Premium, Levies, Total. Also right-align the "Total premium payable" label.

### 2. Minimum excess update
In the Remarks section, change "Own damage claims: 2.5% of value min. KES. 15,000" → "Own damage claims: 2.5% of value min. KES. 5,000".

### 3. Payment details block
Add a new section between the remarks and the footer titled "Payment Details":
- M-PESA Till Number (Safaricom): 603830
- KCB Paybill: 522533, Account: 1211118266

Rendered as a bordered light-blue panel spanning the page width, with bold labels.

### 4. Stamp with current date
Upload `user-uploads://zest_trans_logo.png` via `lovable-assets` to get a CDN URL and import it as `stampAsset` alongside the existing logo asset. In the PDF:
- Place the stamp in the bottom-right area, above the footer (≈110 pt wide).
- Overlay today's date (formatted `DD/MM/YYYY`) in a small handwriting-style font centered on the stamp's signature line.

Use the existing `loadLogo` pattern (rename helper to `loadImage(url)`) to fetch the stamp as a data URL once per render.

### Layout adjustments
Reserve vertical space so payment details + stamp don't collide with the blue footer band. If content overflows page, add `doc.addPage()` before payment details.

### Out of scope
- No DB or business-logic changes.
- No changes to quote dialog form or PDF header.
