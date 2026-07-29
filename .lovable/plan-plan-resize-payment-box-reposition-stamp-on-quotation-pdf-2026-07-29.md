# Plan: Resize payment box & reposition stamp on Quotation PDF

## Context
In `src/lib/quotation-pdf.ts`, the "Payment Details" panel (lines 195–237) currently spans almost the full landscape A4 width (`payW = pageW - margin*2 - 160` ≈ 634pt), which looks overstretched. The Zest stamp sits jammed against the far-right edge (`stampX = pageW - margin - stampSize`).

A4 landscape: `pageW ≈ 841.89pt`, `margin = 24`, `stampSize = 110`.

The payment content (labels + values) only reaches ~`margin + 380`pt, so a ~400pt box fits everything with comfortable padding.

## Changes (single file: `src/lib/quotation-pdf.ts`)

### 1. Shrink the payment details box to a reasonable width
- Replace `const payW = pageW - margin * 2 - 160;` with a fixed reasonable width:
  `const payW = 400;`
- The box content (rows at `margin+12`, `margin+145`, `margin+230`, `margin+330`) all fit within 400pt with room to spare, so no text repositioning is needed.

### 2. Move the stamp to the center-left, vertically aligned with the payment box
- Currently: `stampX = pageW - margin - stampSize` (far right).
- New: place the stamp just to the right of the (now narrower) payment box, centered horizontally in the gap to the page's left-center area and vertically centered with the box.
  - `stampX = margin + payW + 24` (sits right after the payment box, ~448pt from left — center-left of the page).
  - Keep `stampY = payY + (payH / 2) - (stampSize / 2)` so the stamp stays vertically centered with the payment panel.
- This moves the stamp from the far right into the center-left zone, aligned with the payment box's vertical center.

### 3. Keep everything else unchanged
- Header, table, remarks, and footer band positions are untouched.
- Overflow/new-page logic for the payment section remains the same.

## Verification
- Generate a quotation PDF (download via the Quotations page "Download PDF" action).
- Open the PDF and confirm:
  - The "Payment Details" box is a reasonable width (~400pt), no longer stretched to the right.
  - The stamp appears to the right of the payment box in the center-left area, vertically centered with it, not jammed against the right edge.
