# Renewals: show only the current cover per risk

## Problem

The Renewals page lists every policy whose end date falls within the next 60 days, with no check for whether that cover has already been renewed. A database check confirms 106 policies currently listed are superseded — the same vehicle already has a newer policy with a later end date — so staff see stale expiry dates instead of the real one.

## Fix

Renewals will show one row per risk: the latest cover only.

- Group the fetched policies by vehicle (and, when there is no vehicle, by client + product class for non-motor covers).
- Keep only the policy with the latest end date in each group; drop the superseded ones.
- Follow the renewal chain too: any policy referenced as `previous_policy_id` by a newer policy is treated as superseded and hidden.
- Cancelled policies stay excluded as they are today.

Result: a vehicle renewed to 2027 no longer appears as "overdue" on its 2024 cover — only its current expiry date shows, in the right urgency bucket.

## Also cleaned up

- Exclude policies with clearly invalid dates (e.g. the one record with end date 0001-01-01) so they don't pollute the Overdue bucket.
- Keep the existing search, buckets, and empty states unchanged.

## Technical notes

- Change is contained to `src/routes/_authenticated/renewals.tsx`: extend the query select with `previous_policy_id`, `vehicle_id`, `product_class`, then dedupe client-side before bucketing.
- Day counts continue to use the existing local-date parsing helper (`parseLocalDate` from `src/lib/date-only.ts`) so buckets don't shift by a day.
- No database or schema changes.
