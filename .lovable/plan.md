## Changes

### 1. Auto-calculate Levies (`src/routes/_authenticated/quotations.tsx`)
- Remove the manual **Levies** input field from the new-quote dialog.
- Compute levies automatically as: `levies = (basePremium + benefitsTotal) * 0.0045 + 40`.
- Display levies as a read-only line in the summary box (still persisted to `line_items.levies` and included in the Total).
- Total Premium Payable = `basePremium + benefitsTotal + levies` (unchanged formula, but levies now derived).

### 2. Fix Remarks rendering on PDF (`src/lib/quotation-pdf.ts`)
The current PDF uses `didDrawCell` to manually paint the merged Remarks column, but the text overflows / overlaps the table grid because:
- The cell height is computed from the other (short) rows, so the long remarks text is drawn outside the cell bounds.
- Long lines aren't wrapped before measuring row height.

Fix approach:
- Drop the `rowSpan` + `didDrawCell` hack for Remarks.
- Instead, build the Remarks content as a single pre-wrapped multi-line string and place it in the **first data row only** with a real `rowSpan` matching the number of body rows, letting autoTable size the row naturally based on that cell's wrapped content. Use `cellWidth` fixed + `overflow: 'linebreak'` so autoTable wraps and expands row height correctly.
- Format remarks with section headings (bold) and bullet lines using `\n` separators; rely on autoTable's built-in line wrapping rather than manual `doc.text` calls.
- Verify by generating a sample PDF and visually inspecting it (pdftoppm → image) to confirm no overlap, no clipping, and remarks are fully visible alongside the cover/benefit rows.

### Out of scope
- No DB schema changes.
- No changes to approval flow, list view, or portal-side quotation views.
