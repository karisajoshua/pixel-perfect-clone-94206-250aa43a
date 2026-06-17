## Issue
Saving an edited policy fails with "Could not find the 'clients' column of 'policies' in the schema cache".

## Cause
The policy detail page loads the policy with a joined `clients(...)` (and likely `insurers(...)`, `vehicles(...)`, `branches(...)`) relation. That joined object is passed into the form as `initial`, and on save the whole `form` is spread into the update payload, so Supabase tries to write a non-existent `clients` column.

## Fix
In `src/components/policies/policy-form-dialog.tsx`, build the update/insert payload from an explicit allow-list of real columns instead of `...form`. Columns to keep: `policy_no, client_id, vehicle_id, insurer_id, branch_id, product_class, cover_type, sum_insured, premium_gross, premium_net, commission, taxes, start_date, end_date, status, payment_status, previous_policy_id, document_url, notes`. Add `created_by` only on insert (do not overwrite the original creator on edit).

No DB or schema changes needed.
