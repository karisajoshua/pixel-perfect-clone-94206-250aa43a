# Fix benefit rate on the PDF + add PLL and PA options

## Problem

The editable **Benefit rate %** is saved correctly with the quote, but the quotation PDF ignores it: the PDF generator hardcodes 0.25%, so both the per-benefit premium and the "Rate %" column always print 0.25. That is why the change "doesn't apply after saving".

## What changes

1. **PDF uses the saved rate**
   - The PDF reads `benefit_rate_pct` from the quote (falling back to 0.25 for older quotes) and uses it for each benefit line's rate column and premium, plus the gross/total.

2. **PLL and PA as separate priced items**
   - Two new checkboxes in the New/Edit quote dialog (comprehensive covers): **Passenger Legal Liability (PLL)** and **Personal Accident (PA)**.
   - Each has its own editable amount field (KES), enabled when its box is checked.
   - These amounts are added into the gross premium, so levies and the total premium payable include them.
   - They also appear as their own rows in the quotation PDF table and in the dialog's summary panel.

## Technical notes

- `src/routes/_authenticated/quotations.tsx`: add `pll_enabled` / `pll_amount` and `pa_enabled` / `pa_amount` to the `line_items` JSON (no migration needed); include them in `premiumGross` before levies, and in the saved payload.
- `src/lib/quotation-pdf.ts`: replace the hardcoded `0.0025` / `"0.25"` with the quote's `benefit_rate_pct`; append PLL and PA rows (amount shown in the Premium column, blank rate) and include them in the gross/total.
- Existing quotes without these fields render exactly as they do today.
