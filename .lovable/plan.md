
## Goal
- Wipe the leftover demo data so only what you imported remains.
- Promote the insurer / installment / month info that's currently stuffed into `vehicles.notes` (~1063 rows) into proper **policy** records, linked to the right insurer, client, and vehicle. Your client + vehicle list stays untouched.

## What the demo data looks like
Everything seeded by Lovable has `created_by = NULL`; everything you imported has your user id on it. Counts:
| Table | Seed (to delete) | Yours (to keep) |
|---|---|---|
| clients | 6 | 1,007 |
| vehicles | 8 | 1,213 |
| policies | 10 | 0 |
| invoices | 8 | 0 |
| claims | 4 | 0 |

## What I'll do

### 1. Delete seed rows
- `claims`, `invoice_items`, `invoices`, `payments`, `policies`, `quotations` → delete every row where `created_by IS NULL`.
- `vehicles`, `clients` → same, in that order (vehicles before clients to respect the FK).
- `notifications` for any deleted policies are removed too.

### 2. Build policies from the imported notes
For each vehicle whose `notes` starts with `Insurer:`, parse out:
- `INSURER` → matched (case-insensitive, ignoring punctuation/`/MANKONE` etc) against the existing 14 insurers; unknown names (TRIDENT, KENINDIA, OIC, KAI, AAR, MADISON, GA, FIDELITY, JUBILEE, MAYFAIR, OCCIDENTAL, REAL, METROPOLITAN, RESOLUTION, etc.) are auto-created in `insurers` as we encounter them.
- `INSTALLMENT` → kept as a note on the policy ("Installment: 1ST,").
- `MONTH` → interpreted as renewal month in `MMYY` / `MYY` format (e.g. `1224` → Dec 2024, `824` → Aug 2024). `end_date` = last day of that month; `start_date` = `end_date - 1 year + 1 day`. Rows that don't parse cleanly get a sensible default (`start_date = today`, `end_date = today + 1 year`) and a `notes` marker.
- Policy number: `IMP-{seq}` so they don't collide with your real numbering when you start issuing.
- `product_class` / `cover_type`: defaults (`motor_private` / `comprehensive`) — these aren't on the sheet and you can edit per-policy from the Policies page.
- `status`: `expired` if `end_date < today`, `active` if it's in the future, `pending` if no date could be derived.
- `sum_insured`, `premium_gross`, `premium_net`, `commission`, `taxes`: left blank — they weren't in the import. You'll fill them as renewals come up.
- `client_id` / `vehicle_id` / `branch_id` (NULL for now): taken from the vehicle row.
- After the policy is created, the `Insurer:` / `Installment:` / `Month:` text is stripped from the vehicle's `notes` so the vehicle page stays clean. Any non-policy notes you may have added later stay put.

### 3. Skipped rows (logged, not crashed)
- Vehicles with no `Insurer:` in notes → stay as-is (158 currently — they had no insurer info on the sheet).
- Duplicate `(client_id, insurer_id, end_date)` → only the first becomes a policy; the rest are skipped to avoid duplicates.

## Out of scope
- I'm not inventing premium/sum-insured numbers — those weren't on the sheet, so the policies will show "—" for those columns until you fill them.
- No invoices/claims/quotations are generated from the import.
- No changes to the import page itself; this is a one-shot cleanup + backfill against what's already in the database.

## After this runs
- `/clients` and `/vehicles` show only your 1,007 clients and 1,213 vehicles.
- `/policies` shows ~1,063 policies, each linked to a client + vehicle + insurer, sortable by expiry. Renewal reminders will start firing against real `end_date`s.
- `/insurers` admin page will list whichever new insurer names appeared in your data alongside the original 14.
