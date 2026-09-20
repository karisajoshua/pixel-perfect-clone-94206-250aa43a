# Make the two dashboards agree

The main dashboard and the analytics/reports page count the same things in different
ways, so the numbers never match and nobody can tell which is right.

## What is actually different today

| Figure | Main dashboard | Analytics page |
| --- | --- | --- |
| Active covers | Only covers whose certificate dates still cover today, and not cancelled | Every record whose saved status says "active", even if it expired months ago |
| Active cover premium | Sum of the above (today's live covers) | Sum of all "active" records, expired ones included |
| Revenue | Every payment ever received | Only payments inside the chosen date range |
| Open claims | All open claims | All open claims (same) |

So the analytics page over-counts covers and premium, and its revenue is a
period figure while the dashboard's is a lifetime figure. Both are "correct"
for different questions, but nothing on screen says which question it answers.

## The fix

1. **One definition of an active cover.** Move the dashboard's rule (dates still
   cover today, not cancelled, not future-dated) into one shared helper and use it
   on both pages. Active covers and active cover premium will then match exactly.
2. **Say what each number means.** On the analytics page, label the live figures
   "as of today" and the period figures "in selected period", so the two revenue
   numbers are visibly answering different questions rather than contradicting.
3. **Add period revenue to the main dashboard's wording.** The dashboard already
   shows both lifetime revenue and this-month revenue — relabel them as
   "Total collected (all time)" and "Collected this month" so a reader can line
   them up against the analytics range figure.
4. **Keep new business consistent.** Both pages already use the same first-time
   business rule (no previous cover, not a second instalment or rest-of-period);
   keep that, driven from the same shared helper.

Nothing in the records changes — this is purely how figures are computed for
display and how they are labelled.

## Technical notes

- New shared module `src/lib/metrics.shared.ts` exporting `isLiveCover(policy, today)`
  and `isNewBusiness(policy)`; both `dashboard.functions.ts` and
  `reports.functions.ts` import it instead of inlining their own filters.
- `reports.functions.ts`: `activePoliciesList` switches from `status === "active"`
  to `isLiveCover`; `activeCoverPremium` follows. Add `revenueAllTime` to the
  reports payload so the analytics page can show both figures side by side.
- `dashboard.tsx` / `reports.tsx`: card labels and helper text updated; no layout
  rework. No database migration.
