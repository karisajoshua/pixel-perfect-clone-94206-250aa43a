# Import real client + vehicle data

The photo shows ~1000 rows of a Microsoft Excel sheet ("CLIENTS DATA RUAI") with two tabs: PRIVATE and COMMERCIAL. A phone photo cannot be transcribed reliably at that scale, so the right move is to give you an import tool in the app and use the visible rows as a starter seed.

## What I'll build

### 1. Admin → Data Import page (new)
- New route: `/admin/import` linked from the sidebar under the Admin section.
- Two-step flow:
  1. Upload the `.xlsx` (or paste CSV). I parse it in-browser with `xlsx` (SheetJS).
  2. Preview the first 20 rows with a column-mapping table, then "Import" runs in batches of 200.
- Sheet picker so you can import PRIVATE and COMMERCIAL separately, with usage_type auto-set per sheet.
- Dedup rules:
  - Clients: by KRA PIN if present, else by `full_name` (case-insensitive).
  - Vehicles: by `registration_no` (unique per client).
- Result toast: "Imported X clients, Y vehicles, skipped Z duplicates."

### 2. Column mapping (Excel → DB)
| Excel column | Goes to |
|---|---|
| NAME | `clients.full_name` |
| ID | `clients.id_number` |
| KRA PIN | `clients.kra_pin` |
| REG | `vehicles.registration_no` |
| MAKE | `vehicles.make` |
| MODEL | `vehicles.model` |
| BODY | `vehicles.body_type` |
| CC | `vehicles.cubic_capacity` |
| COLOUR | `vehicles.color` |
| YEAR | `vehicles.year` |
| CHASSIS NO | `vehicles.chassis_no` |
| ENGINE NO | `vehicles.engine_no` |
| COMPANY | matched to `insurers.name` (kept as note if no match) |
| INSTALLMENT / MONTH / S/INS | stored in `vehicles.notes` for now (no policy rows created — those need premium + dates we don't have) |

Sheet tab → `vehicles.usage_type`: `PRIVATE` → `private`, `COMMERCIAL` → `commercial`.

### 3. Seed the ~30 visible rows now
I'll transcribe the rows visible in the photo (Stephen Mukana Kwendo → Susan Wangari Baya) and insert them as a starter so you can immediately see real data in /clients and /vehicles. The full sheet comes in via the import page once you upload the file.

### 4. Drop mock data
Remove the seeded mock clients/vehicles from earlier (if any are tagged as demo) so only real data shows.

## Out of scope (ask if you want these too)
- Creating policies from the COMPANY/INSTALLMENT/SUM INSURED columns — those need start/end dates and premium amounts that aren't on the sheet.
- Importing into any other form (quotes, invoices, claims).

## Next step
Approve this and I'll implement, then you upload `CLIENTS DATA RUAI.xlsx` on the new /admin/import page to bring in all ~1000 rows.
