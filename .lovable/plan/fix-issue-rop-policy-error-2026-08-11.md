# Fix "Issue ROP policy" error

## What's wrong

The database still only accepts the four original policy terms — `1 mo (TOR)`, `1 mo extendable`, `6 mo` and `Annual`. When the app tries to create the follow-on cover with the new terms `Rest of Period (ROP)` or `2nd installment`, the database rejects the record and the page shows an error.

The same rule blocks saving a quotation or policy manually set to those two new terms.

## The fix

1. Update the allowed-terms rule on both the policies and quotations tables so it also accepts `second_installment` and `rop`.
2. Make the "Issue next cover / ROP policy" action resilient to a duplicate policy number: if `<policy no>-ROP` already exists, append a counter (`-ROP-2`) instead of failing, and surface a clear message if it still can't save.

## Technical notes

- Migration: drop and recreate `policies_policy_term_check` and `quotations_policy_term_check` with the array `('tor','one_month_extendable','second_installment','rop','six_months','annual')`.
- `src/routes/_authenticated/policies.$id.tsx` → `issueNextCover`: retry the insert with a suffixed policy number on unique-violation (`23505` on `policies_no_unique`).
