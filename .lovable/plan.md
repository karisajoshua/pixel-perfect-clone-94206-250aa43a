## Goal

1. Get "active cover premium" actually showing on the dashboard and reports by populating the missing premium values, then switch revenue to be driven by paid invoices/payments (what the company has *made*).
2. Merge duplicate clients and remove duplicate policies/vehicles created by repeated imports.

---

## 1. Fix premium values (data + importer)

The importer was reading the `INSTALLMENT` sheet column as the premium amount, but that column holds text like "1ST", "ANNUAL", "1,2,CANCELLED". Real premium comes from the `S/INS` (sum insured) column, in thousands; when two numbers are present in one cell (e.g. "150 + 50"), they sum.

### Importer fix — `src/routes/_authenticated/admin.import.tsx`
- New helper `parseSinsToKES(raw)`:
  - Splits the cell on `+`, `,`, `&`, `/` and `\n`, parses each part to a number, sums them, multiplies by 1,000.
  - Ignores non-numeric tokens (e.g. "CANCELLED").
- In the policy draft pass:
  - `sum_insured` = `parseSinsToKES(S/INS)` (was being treated as a flat number).
  - `premium_gross` = `parseSinsToKES(S/INS)` (replaces the wrong `installment` value).
  - Keep `installment` text in `notes` so payment status info isn't lost.
  - `payment_status` derived from whether the installment text contains "PAID", "ANNUAL", or a digit like "1ST/2ND" (best-effort), defaulting to `unpaid`.
- Invoice creation:
  - Issue one invoice per policy for the full `premium_gross`.
  - Mark `amount_paid = total` and `status = 'paid'` only when the installment text contains "PAID" or "ANNUAL"; otherwise leave `amount_paid = 0` and `status = 'sent'`.

### Backfill existing rows (one-off `supabase--insert` SQL)
Re-derive premium/sum-insured for the already-imported `IMP-*` policies from their `notes` field is unreliable because notes only contain the installment text, not S/INS. Instead, after the importer is fixed, the user re-uploads the same sheet — the dedupe key `(client, vehicle, insurer, end_date)` skips re-inserts, so a new "Backfill premium from sheet" mode is added to the importer that:
- For matching `(client, vehicle, insurer, end_date)` policies with NULL `premium_gross`, UPDATE the row with the freshly parsed value instead of skipping.
- Same logic creates invoices for those previously-missed policies.

A toggle on the Import page (`Mode: Insert new` / `Backfill missing values`) controls which branch runs.

---

## 2. Revenue = money received (paid invoices/payments)

The user prefers revenue to reflect actual income. Switch the metric back to payments-based, but keep "active cover premium" as a separate informational metric so both numbers are visible.

### `src/lib/dashboard.functions.ts`
- Add `paymentsRes = scope(supabase.from("payments").select("amount, paid_at, branch_id"))`.
- `totals.revenue` = sum of `payments.amount`.
- `totals.revenueThisMonth` = sum where `paid_at >= monthStart`.
- Add `totals.activeCoverPremium` = current sum of active-policy `premium_gross` (kept for the secondary line).
- `byBranch.revenue` = payments per branch; add `byBranch.activeCoverPremium` for the branch table.

### `src/lib/reports.functions.ts`
- `kpis.revenue` = payments in `[from,to]`.
- Add `kpis.activeCoverPremium` for the new tile.
- `revenueOverTime` bucketed by `paid_at` month.

### UI
- `src/routes/_authenticated/dashboard.tsx`: keep the existing "Total revenue" card (now payments-driven), add a second tile under it for admins: "Active cover premium" with the gross figure. Update the branch table to add an "Active cover" column.
- `src/routes/_authenticated/reports.tsx`: change KPI label back to "Revenue (paid)" and add an "Active cover premium" tile next to it. Update CSV headers.

---

## 3. Merge duplicate clients & dedupe policies

Run as a one-off `supabase--insert` script (no schema change). Steps, in order:

### a. Pick a survivor per duplicate group
- Group `public.clients` by `nameKey(full_name)` (uppercase, punctuation-stripped, sorted-words) AND/OR matching `phone`/`email`/`kra_pin`.
- Survivor = row with the most non-null contact fields, tiebreaker = oldest `created_at`.

### b. Re-point children to the survivor
For each non-survivor `id` in a group, `UPDATE` foreign keys to point at the survivor across:
`vehicles`, `policies`, `quotations`, `invoices`, `payments`, `claims`, `client_communications`, `service_requests`, `client_required_documents`.

### c. Backfill survivor with merged contact info
`UPDATE clients` survivor with COALESCE of non-survivor phone/alt_phone/email/kra_pin/id_number/address/etc., then `DELETE` the non-survivors.

### d. Dedupe policies
`DELETE` policies where `(client_id, vehicle_id, insurer_id, end_date)` is duplicated, keeping the earliest row. Repoint dependent invoices/payments/claims to the kept policy first.

### e. Dedupe vehicles
A unique index on `lower(registration_no)` already blocks new dupes; any historical orphan with a different reg is left alone unless it's an exact match to another row (none expected — confirmed by the unique index).

Each step prints affected row counts so the user can sanity-check.

---

## Technical notes
- No new tables, no schema migrations — only data updates (`supabase--insert`) and code edits.
- Branch scoping in dashboard/reports is preserved.
- The importer's existing dedupe key still applies, so re-uploading is safe.
- After the cleanup + re-upload, dashboard "Total revenue" reflects actual paid amounts and "Active cover premium" shows the gross exposure.
