# One-month installments and Rest of Period (ROP)

Make the system understand what happens after a client takes a 1-month extendable cover: either they clear the balance and get the Rest of Period, or they split the balance into a 2nd installment and clear it on the 3rd month before getting ROP.

## What changes for the user

### 1. Policy term gains a "Rest of Period (ROP)" option
Terms become: 1 mo (TOR), 1 mo extendable, 2nd installment, Rest of Period (ROP), 6 mo, Annual.
- "2nd installment" marks the middle month of the 3-month path.
- "Rest of Period (ROP)" marks the balance-clearing cover that runs to the annual anniversary.

### 2. Payment plan choice on a 1-month extendable policy
On the policy page, a "Payment plan" selector appears only when the term is 1 mo extendable:
- **Clear balance next month → ROP** (default)
- **Split into 2 installments (2nd month, then clear on 3rd month)**

The choice is stored on the policy and shown as a badge, so any staff member opening the policy knows what is expected next. Staff still add each extension entry manually as they do today — the plan only tells the system and the team what is due next.

### 3. Balance comes from the annual premium
The policy's Gross premium is treated as the full annual premium. The policy page shows:
- Annual premium
- Paid to date (from receipts)
- Balance to clear
- Suggested next installment: full balance under the "clear" plan, half the balance under the "2 installments" plan (with the 3rd-month remainder shown).

The "Add extension" dialog prefills the amount with that suggestion and the due date with the current cover's end date, so staff just confirm.

### 4. "Issue ROP policy" action
When the balance is cleared (or staff choose to proceed anyway, with a warning), a button creates a **new linked policy**:
- Term = Rest of Period (ROP)
- Start = day after the current cover ends
- End = the original cover's start date plus 12 months (so a cover started 1 Mar → ROP ends 28 Feb next year; an 11-month ROP after one month, 10 after two)
- Same client, vehicle, insurer, branch, product and cover type
- Premium = remaining annual premium; certificate/policy number left for staff to fill
- Linked back to the previous policy, so the chain is visible from either side

The same button on a "2nd installment" policy issues the 3rd-month cover, and after that the ROP.

### 5. Lists and filters
- The **ROP** filter on Policies includes the new `rop` term alongside 6-month and annual.
- The **1 mo TOR** filter is unchanged.
- Vehicle cover cards and the policy list show the new term labels.
- Policies on a 1-month path whose cover end date has passed while a balance remains are flagged as "Installment due" on the policy list and dashboard, next to the existing overdue-extension count.

## Technical notes

- Migration: add `installment_plan text` to `public.policies` (values `clear_balance`, `two_installments`, null) and `rop_of_policy_id uuid references public.policies(id)` for the chain; no new tables. `policy_term` stays free text, so `second_installment` and `rop` need no enum change.
- `POLICY_TERM_LABELS` in `src/lib/utils.ts` gains `second_installment` and `rop`; term→end-date maths in `src/components/policies/policy-form-dialog.tsx` and `src/routes/_authenticated/quotations.tsx` gains cases for both (ROP end = anniversary of the chain's original start).
- New helper `src/lib/policy-installments.ts`: computes balance, suggested installment split, anniversary end date, and builds the ROP/next-installment policy payload from a source policy.
- `src/routes/_authenticated/policies.$id.tsx`: payment-plan selector, installment summary card, prefilled extension dialog, and the "Issue next cover / ROP policy" action.
- `src/routes/_authenticated/policies.tsx`: `rop` added to the ROP filter set, plus an "Installment due" badge.
- Existing `syncPolicyFromInvoice` keeps driving `payment_status`/`balance_due`; the new summary reads those fields rather than duplicating the logic.
