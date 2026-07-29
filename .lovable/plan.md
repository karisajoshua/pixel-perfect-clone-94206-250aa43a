# Editable benefit (excess) rate on quotations

Today the additional-benefits charge is hardcoded at 0.25% of the sum insured per selected benefit. That rate doesn't apply to commercial risks, so it needs to be editable per quote.

## What changes

In the New/Edit quote dialog (comprehensive covers only):

- Add a **Benefit rate %** input next to Rate %, defaulting to 0.25.
- The rate is stored with the quote so re-opening or editing an existing quote keeps the value used at the time.
- The helper text becomes dynamic: "Each selected benefit is priced at {rate}% of the sum insured."
- The summary line and saved gross/net premium recalculate from the entered rate.

Nothing else about pricing changes: base premium, levies (0.45% + KES 40) and the third-party flat-premium path stay as they are.

## Technical notes

- File: `src/routes/_authenticated/quotations.tsx`.
- Store as `line_items.benefit_rate_pct` (existing JSON column, no migration needed).
- `benefitPremium = sumInsured * (benefitRatePct / 100) * benefits.length`, with fallback to 0.25 when the field is absent so existing quotes keep their current figures.
- Include `benefit_rate_pct` in the non-third-party `line_items` payload on save.
