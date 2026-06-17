## Goal
Make the Import page populate the whole system in one shot (clients, vehicles, insurers, policies, invoices, paid payments) so dashboard counters and Total Revenue update automatically from the sheet — using the `INSTALLMENT` column as the revenue figure.

## Changes (all in `src/routes/_authenticated/admin.import.tsx`)

The existing client + vehicle passes stay as-is. Add these passes after vehicles are inserted:

1. **Insurers — auto-create from `COMPANY`**
   - Load all existing insurers once.
   - Normalize the `COMPANY` value (trim, strip trailing `/MANKONE` etc., title-case).
   - For each unique normalized name not already present, insert into `insurers` with `active=true`.
   - Build a `name → id` map keyed by normalized name.

2. **Policies — one per imported vehicle that has an insurer**
   - Skip rows with no `COMPANY`.
   - Parse `MONTH` (`MM`, `MMYY`, `MYY`) → `end_date`; `start_date = end_date − 1 year`.
   - Defaults: `product_class='motor_private'` (or `motor_commercial` when sheet usage is commercial/PSV/hire), `cover_type='comprehensive'`, `status` derived from dates (`expired` / `active` / `pending`), `payment_status='paid'` when an installment is present else `unpaid`.
   - `premium_gross` and `premium_net` = `INSTALLMENT` value (numeric).
   - `sum_insured` from `S/INS` if numeric.
   - `policy_no` = `IMP-{YYYYMMDD}-{seq}` to avoid collisions.
   - Dedupe per import on `(client_id, vehicle_id, insurer_id, end_date)` and skip if a policy already exists matching that key in DB.
   - Insert in batches; collect the returned `id`s.

3. **Invoices — one per new policy with an installment amount**
   - Skip policies with no installment.
   - `invoice_no` = `INV-{YYYYMMDD}-{seq}`; `client_id`, `policy_id` from the policy; `issue_date = today`; `due_date = today + 30d`.
   - `subtotal = total = amount_paid = installment`, `tax = 0`, `status = 'paid'`.

4. **Payments — one per invoice (so Total Revenue updates)**
   - `invoice_id` from the invoice just created, `amount = installment`, `paid_date = today`, `method = 'import'`, `reference = 'Imported from sheet'`, `recorded_by = current user`.
   - This is the only thing that actually moves `revenue` on the dashboard (which sums `payments.amount`).

5. **Vehicle notes cleanup**
   - After a policy is created from a vehicle, strip the `Insurer:` / `Installment:` / `Month:` / `Sum insured:` fragments from that vehicle's `notes` (leave any remaining text).

6. **Idempotency**
   - Existing clients (by KRA PIN / name) and vehicles (by registration) already dedupe.
   - Policies dedupe on `(client_id, vehicle_id, insurer_id, end_date)`.
   - Invoices/payments only created for policies created this run, so re-running the same import won't double-charge revenue.

7. **Import log**
   - Extend the final log line to: `X clients, Y vehicles, Z insurers, P policies, I invoices, KES R revenue added`.

## Why policies are included
The user picked Insurers + Invoices + Payments. `invoices.policy_id` is the link that ties an invoice to a vehicle/cover period and feeds the "active policies" KPI; without a policy the invoice has no business context. Creating the policy is required to make the invoice meaningful.

## Out of scope
- No changes to the form/UI other than the log line.
- No changes to RLS, schema, or other pages.
- Sheets with no `COMPANY`/`INSTALLMENT` still import clients + vehicles only (current behavior).
