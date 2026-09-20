# Improve the analytics dashboard and reports

## Goal
Make the agency dashboard and Reports & Analytics page polished and easy to use on phones, tablets, and desktops, while adding a clear monthly view of new business.

New business will mean **first-time policies only**. Renewals, second instalments, and rest-of-period covers will be excluded.

## What changes

### 1. Mobile-friendly dashboard
- Replace the fixed desktop spacing with responsive page spacing and tighter mobile sections.
- Reorganise summary figures into a compact, scannable mobile grid with clearer hierarchy for currency, counts, and supporting details.
- Make long currency values fit cleanly without clipping or shifting cards.
- Convert wide tables into mobile-safe views: concise stacked rows on phones and full tables on larger screens.
- Improve empty and loading states without changing permissions or the figures currently shown.

### 2. Better Reports & Analytics layout
- Make the title, export actions, date range, and branch selector stack cleanly on narrow screens.
- Refine the summary cards so six figures remain readable at every screen size.
- Use a stronger visual hierarchy and more balanced spacing while preserving the agency’s existing colours and branding.
- Keep CSV and print/PDF export working, including the new-business data.

### 3. Improved charts
- Replace hardcoded chart colours with the existing semantic chart palette so charts remain consistent with agency theming and dark mode.
- Improve axis labels, currency abbreviations, tooltips, legends, spacing, and chart margins.
- Adjust chart heights and labels for phones, including readable insurer names and policy statuses without horizontal page overflow.
- Add accessible chart summaries and clearer empty states.

### 4. New business per month
- Extend report calculations with a monthly series for first-time policies in the selected date range.
- A policy counts as new business only when it has no previous policy link and is not a second instalment or rest-of-period cover.
- Respect the existing branch permissions and selected branch filter.
- Show a dedicated monthly chart with both policy count and gross premium value, plus a selected-period “New business” summary figure.
- Include the monthly count and premium value in CSV and printed reports.

### 5. Accuracy and validation
- Keep all existing tenant and branch isolation rules unchanged.
- Use policy commencement month for monthly grouping, matching the selected reporting dates.
- Verify the dashboard and reports at phone and desktop widths, including long values, empty data, tables, filters, and chart tooltips.
- Add complete page titles and sharing descriptions for the Dashboard and Reports pages.

## Technical notes
- Update the authenticated report calculation and its response type with `newBusinessByMonth` and selected-period totals.
- Identify first-time business using `previous_policy_id` plus installment term exclusions; no records are modified.
- Refactor the two page layouts only where needed, using existing cards, buttons, inputs, and semantic colour tokens.
- No database migration is required.
