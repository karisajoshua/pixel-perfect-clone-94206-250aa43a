# Fix incorrect renewal end dates

## Confirmed issue

Policy `DA/0906/000100/2025 ROP` for vehicle `KDS427H` is stored with a start date of **3 Apr 2026** and an end date of **4 Feb 2026**. This is the only policy in the database whose end date is earlier than its start date. Its linked history contains a one-month cover followed by a second installment, so the ROP period should continue from that installment to the original annual anniversary.

The Renewals screen currently displays the stored `end_date` directly and chooses one row per vehicle using the greatest end date rather than resolving the actual linked renewal/installment chain.

## Implementation

1. **Repair the affected policy chain**
   - Add a targeted database migration for the identified policy record.
   - Correct its term to ROP, link it to the second-installment record, and set the ROP dates from the day after that installment through the original policy anniversary.
   - Preserve tenant, client, vehicle, insurer, premium, and payment data.

2. **Prevent invalid policy dates**
   - Add database validation so a policy cannot be saved with an end date earlier than its start date.
   - Add matching form validation with a clear message before submission.
   - Centralize date calculations on date-only helpers to avoid UTC and off-by-one inconsistencies.

3. **Make Renewals chain-aware**
   - Resolve current cover rows from `previous_policy_id` links instead of selecting the greatest date for every vehicle/client grouping.
   - Exclude superseded covers while retaining separate legitimate policies for the same client or risk.
   - Keep the existing 60-day urgency buckets and search behavior.

4. **Verify**
   - Confirm the repaired policy shows the corrected expiry on its details page and Renewals.
   - Test one-month → second installment → ROP date generation, annual renewals, and invalid-date rejection.
   - Check that previously renewed policies do not reappear and unrelated policies are not collapsed together.

## Technical details

- The expected ROP date range will be calculated from the confirmed chain rather than inferred from the policy number.
- The migration will include an explicit constraint after repairing the existing invalid row, ensuring deployment does not fail on historical data.
- Query invalidation will continue to refresh policy, renewal, and dashboard views after policy changes.
