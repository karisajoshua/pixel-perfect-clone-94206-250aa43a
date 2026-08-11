# Always show the balance due on partly paid covers

Right now a cover marked "partial" often shows no balance at all. Two causes, both confirmed in the data:

- 6 of the 12 partly paid policies have no balance and no premium saved — they were marked partial by hand on the vehicle cover form, which never required an amount, and they have no invoice to calculate from.
- Where a balance does exist, it is only displayed on the vehicle cover card and inside the installment-plan card (which only appears for one-month/installment terms). The Policies list and the Policy details panel never show it.

## What changes

### 1. Balance shown everywhere a cover appears
- **Policy details panel**: new "Amount paid" and "Balance due" rows next to Gross premium, with the balance highlighted when it is above zero.
- **Policies list**: the Status column gains a "Bal. KES x" chip on every policy that is partial or unpaid with an outstanding amount; the Premium column shows the paid/total split for partly paid covers.
- **Client → vehicle cover card**: the existing Balance due field shows a dash today when nothing is stored; it will fall back to the calculated figure and be highlighted when outstanding.
- **Client portal policy page**: adds Amount paid and Balance due under Gross premium so clients see what they still owe.

### 2. A balance is always derivable
When a policy has no stored balance, it is calculated as annual/gross premium minus everything paid (invoice receipts plus paid extensions). If there is no premium either, the cover shows "Balance not set — add the premium" instead of a silent dash, so staff can fix it.

### 3. Marking a cover partial requires the numbers
On the vehicle "cover" form and the policy form, choosing Payment status = partial requires a premium and shows the balance being saved (auto-filled as premium minus amount paid, still editable). This stops new blank-balance records.

### 4. One-off cleanup of existing records
Recalculate balance due from premium and receipts for every partly paid and unpaid policy that has a premium. The 6 partial covers with no premium at all cannot be calculated — they will surface with the "Balance not set" prompt so staff can enter the premium.

## Technical notes

- New helper `src/lib/policy-balance.ts`: `policyBalance(policy, paid)` returning `{ annual, paid, balance, unknown }`, reusing the receipt/extension totals logic already in `src/lib/policy-installments.ts` so the two agree.
- `src/routes/_authenticated/policies.$id.tsx`: balance rows in the Policy details card (independent of the installment card).
- `src/routes/_authenticated/policies.tsx`: balance chip in the Status cell; the query already selects `balance_due` and `premium_gross`.
- `src/components/clients/client-vehicles.tsx`: fallback + highlight on the existing Balance due field.
- `src/routes/_portal/portal/policies.$id.tsx` (and the `portal.functions.ts` select if `balance_due` is not returned): paid/balance rows.
- `src/components/vehicles/vehicle-form-dialog.tsx` and `src/components/policies/policy-form-dialog.tsx`: auto-fill/validate balance when status is partial.
- Data update over `policies` joined to `invoices`/`payments` to set `balance_due` where it is null but computable; no schema change.