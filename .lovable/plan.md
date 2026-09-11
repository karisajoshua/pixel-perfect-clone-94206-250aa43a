# Renewals page: filter by due-date range

## What changes

Replace the four static bucket cards on the Renewals page with a single dropdown filter that shows one range at a time.

- Filter options:
  - **All** — show every renewal in the next 60 days plus anything overdue
  - **Overdue / due today** — policies whose expiry date is today or already passed
  - **Due in 7 days** — expiry date within the next 7 calendar days
  - **Due in 30 days** — expiry date within the next 30 calendar days
  - **31–60 days** — expiry date between 31 and 60 calendar days from today

- The existing search box stays and works on top of the selected range.
- The existing table row layout stays; only the surrounding bucket cards are removed.
- Empty state updates to say which range currently has no matches.

## Technical detail

In `src/routes/_authenticated/renewals.tsx`:

- Add a `filterRange` state with values `"all" | "overdue" | "7" | "30" | "31-60"`.
- Replace the four `<Bucket ...>` blocks with one filtered list.
- Compute `days` for each row as today already does, then include the row when:
  - `all` → always include
  - `overdue` → `days <= 0`
  - `7` → `days > 0 && days <= 7`
  - `30` → `days > 0 && days <= 30`
  - `31-60` → `days > 31 && days <= 60`
- Render a `<Select>` dropdown next to the search box using the existing `ui/select` component.
- Update the empty message to mention the selected filter, e.g. “No overdue renewals” / “No renewals due in 7 days”.
- Remove the now-unused `Bucket` component or keep it as a simple internal list renderer.

No database or server-function changes are required; the existing query and client-side search remain unchanged.
