## 1. Policy term (duration type)

New enum-like text field `policy_term` with 4 values:
- `tor` — One month (TOR / Temporary On Risk)
- `one_month_extendable` — One month extendable
- `six_months` — 6 months
- `annual` — Annual (default)

Added on both `quotations` and `policies` tables so a quote's chosen term carries over on conversion.

**UI**
- `src/components/policies/policy-form-dialog.tsx` — new "Policy term" Select. When picked, auto-computes `end_date` from `start_date` (30 days / 30 days / 180 days / 1 year); user can still override the date manually.
- `QuoteDialog` in `src/routes/_authenticated/quotations.tsx` — same Select next to Cover type; stored on the quote and copied into the policy on Convert.
- `src/routes/_authenticated/policies.$id.tsx` — show "Term" in the details grid.
- `src/routes/_authenticated/policies.tsx` — show a small term badge in the list.

## 2. Payment extensions (installments / pay-later balance)

Some clients pay part now and the rest later. Model this as a new table
`public.policy_payment_extensions` with columns:
- `policy_id`, `amount_due`, `due_date`, `reason` (text), `status` (`pending`/`paid`/`overdue`), `paid_at`, `created_by`, tenant/branch, timestamps.

RLS: same shape as `policies` (tenant members can read; admin/manager/agent in branch can write; admins agency-wide). Full GRANT block per house rules.

Also add `balance_due` (numeric) on `policies` as a convenience running total; recomputed by a small trigger from active extensions + payments, OR left as a manually maintained field surfaced in UI (simpler; go with manual for v1 — an extension row is the source of truth, `balance_due` is just its sum).

**UI on `policies.$id.tsx`**
- New card "Payment extensions" below Policy details showing:
  - Total premium, total paid (from `payments`), outstanding balance.
  - Table of existing extensions (amount, due date, reason, status, action: mark paid / delete).
  - "Add extension" button → dialog with amount, due date, reason textarea.
- When any extension is `pending` and past `due_date`, badge it Overdue and reflect on policy header.
- When an extension is added, policy `payment_status` auto-shifts to `partial` (if not already `paid`).

**Dashboard** — `src/lib/dashboard.functions.ts` gets a new metric "Outstanding balances" = sum of pending extensions for the branch, plus a small list of the top 5 overdue extensions. Surfaced as a card on `dashboard.tsx`.

## 3. Files touched

- New migration: `policy_term` on `quotations` + `policies`; create `policy_payment_extensions` with GRANTs, RLS, updated_at trigger; add `balance_due` on `policies`.
- `src/components/policies/policy-form-dialog.tsx` — term Select + auto end-date.
- `src/routes/_authenticated/quotations.tsx` — term Select in QuoteDialog; carry to policy in `convert()`.
- `src/routes/_authenticated/policies.tsx` — term badge column.
- `src/routes/_authenticated/policies.$id.tsx` — term display + Payment extensions card + add/mark-paid dialogs.
- `src/lib/dashboard.functions.ts` + `src/routes/_authenticated/dashboard.tsx` — outstanding balances metric.

## Technical notes

- Term is stored as a plain `text` with a CHECK constraint (avoids enum migration ceremony and matches existing `status`/`payment_status` style in this codebase).
- End-date auto-fill uses local JS date math in the form; the DB doesn't enforce term↔dates consistency so users can still adjust.
- Extension writes go through the existing browser Supabase client (RLS-scoped), consistent with how policies/claims are edited today. No new server functions needed.
- On convert (quote → policy), pass `policy_term` through the insert payload alongside existing fields.
