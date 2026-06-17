## 1. Import: capture client contacts

Right now the importer never reads phone/email columns, so imported clients show no contact info.

Extend `src/routes/_authenticated/admin.import.tsx` to map common header variants (case-insensitive, trimmed):

- `email` ← `EMAIL`, `E-MAIL`, `MAIL`
- `phone` ← `PHONE`, `TEL`, `TELEPHONE`, `MOBILE`, `CONTACT`, `CELL`, `MSISDN`
- `alt_phone` ← `ALT PHONE`, `ALT TEL`, `OTHER PHONE`, `PHONE 2`
- `id_number` ← `ID`, `ID NO`, `ID NUMBER`, `REG NO`
- `kra_pin` ← `KRA`, `KRA PIN`, `PIN`

Normalize phone (strip spaces, keep leading `+` or `0`). Apply to **new** client inserts and **also backfill existing** clients in the same sheet when their `phone`/`email` is null — so previously imported clients get updated on re-import.

Add a one-time "Backfill contacts from vehicle notes" button on the import page that scans `clients` with null phone/email and tries to recover from `vehicles.notes` (which currently holds raw row text for older imports), since past imports already lost the columns.

## 2. Clients list: 15 per page

In `src/routes/_authenticated/clients.tsx`:

- Add URL search params via `validateSearch` (`page: number`, defaulted to 1; keep existing `search` text).
- Query with Supabase `.range((page-1)*15, page*15-1)` and `{ count: 'exact' }`.
- Render shadcn `Pagination` (Prev / page numbers / Next) below the table. Reset to page 1 when search changes.
- Show "Showing X–Y of Z" counter.

## 3. Admin export: PDF + Excel with filters

Add an **Export** button next to "New client" on the clients list (admin/manager only — gated via `useMyRoles`).

Opens a dialog with filters:
- **Company name** contains (text)
- **Client type** (any / individual / corporate)
- **Branch** (dropdown)
- **Created between** (date range)
- **KYC status** (any / pending / verified / rejected / expired)
- **Format**: Excel (`.xlsx`) or PDF

On submit:
- Query `clients` (no row limit) with the filters applied server-side.
- **Excel**: build with `xlsx` (SheetJS) client-side — columns: Name, Company, Type, Email, Phone, ID/Reg, KRA PIN, City, KYC, Branch, Created. Download as `clients-YYYY-MM-DD.xlsx`.
- **PDF**: build with `jspdf` + `jspdf-autotable` (already light, client-side) — same columns, landscape A4, with filter summary in the header. Download as `clients-YYYY-MM-DD.pdf`.

Install: `bun add xlsx jspdf jspdf-autotable`.

## Out of scope

- No schema/RLS changes (all data already in `clients`).
- No edits to client detail page (contacts already render there once populated).
- Export limited to clients table (not vehicles/policies) — those can be added later if needed.

## Files touched

- `src/routes/_authenticated/admin.import.tsx` — contact column mapping + backfill action
- `src/routes/_authenticated/clients.tsx` — pagination + export button
- `src/components/clients/client-export-dialog.tsx` — new, filter form + xlsx/pdf generation
- `package.json` — add 3 deps
