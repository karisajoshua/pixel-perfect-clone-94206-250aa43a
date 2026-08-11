# No taxes/levies on third-party covers

Today every quotation adds levies of 0.45% of premium + KES 40, including third-party and TPFT covers. Third-party premiums are flat, statutory amounts, so no levies should be added on top.

## What changes

- In the new/edit quote dialog, when cover type is **Third party** or **TPFT**:
  - Levies are calculated as **0** instead of 0.45% + KES 40.
  - The summary box hides the "Levies" line and shows the total equal to the flat premium entered.
- The saved quote stores `levies: 0`, so the downloaded quotation PDF shows no levy row and a total equal to the flat premium (the PDF already reads the stored levies value, so it follows automatically).
- Comprehensive covers keep the existing 0.45% + KES 40 levy behaviour, unchanged.

## Note on existing quotes

Third-party quotes already saved carry a levy amount. They will keep showing it unless re-saved. If you want, I can also zero out levies on existing third-party quotations in one pass — say the word and I'll include it.

## Technical detail

`src/routes/_authenticated/quotations.tsx`: make `levies` conditional on `isThirdParty` (0 when true), hide the levies row in the summary when zero for third party, and keep `line_items.levies` consistent in the save payload.
