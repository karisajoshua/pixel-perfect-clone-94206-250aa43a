# Policies filter: replace "renewed" with "ROP"

## What changes

On the Policies list, the last filter chip becomes **ROP** (Rest of Period) instead of "renewed".

ROP is not a status — it is a term-based view. Clicking it shows policies whose cover runs longer than a one-month extension, i.e. everything except the 1 month (TOR) and 1 month extendable terms. So ROP lists 6-month and annual policies. Policies with no term recorded are left out, since we can't confirm they run past a month.

The other chips (all, active, pending, expired, cancelled) keep filtering by status exactly as today.

## Technical detail

In `src/routes/_authenticated/policies.tsx`:

- Chip list becomes `["all", "active", "pending", "expired", "cancelled", "rop"]`, with `ROP` shown as the label for the last one.
- In the query, when `rop` is selected, skip the `.eq("status", ...)` filter and apply `.in("policy_term", ["six_months", "annual"])` instead, so filtering still happens server-side.
- Keep the existing `renewed` status badge colour, since policies can still carry that status from "Mark as renewed" and must render correctly in the Status column.