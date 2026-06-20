## Changes

### 1. Mobile auth page — show logo above form
File: `src/routes/index.tsx`

The left-hand panel (with the logo) is hidden on mobile (`lg:hidden`). Add a small header above the sign-in card that's only visible on mobile (`lg:hidden`) showing the red Zest logo centered above the `Welcome to Zest` card.

### 2. Searchable Quotations list
File: `src/routes/_authenticated/quotations.tsx`

- Add a search `Input` in the page header area with a search icon.
- Filter the rendered `data` client-side by quote number, client name (full/company), insurer name, and vehicle registration.
- Keep existing status badges/actions intact.

### 3. Searchable Invoices list
File: `src/routes/_authenticated/invoices.tsx`

- Add a search `Input` next to the existing status filter buttons.
- Filter client-side by invoice number and client name (full/company).
- Preserve status filter and existing columns/actions.

No backend, schema, or auth changes. Purely frontend/presentation.
