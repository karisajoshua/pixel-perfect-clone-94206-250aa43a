# Search any client when transferring vehicle ownership

## Problem
The transfer dialog loads a single fixed batch of clients (first 500, alphabetical) and filters that batch in the browser. Any client outside that batch can never be found, no matter what you type.

## Fix
Replace the in-browser filtering with a live database search, matching how the "Add vehicle" form already works:

- Typing 2+ characters searches the whole client database by person name or company name.
- Results refresh as you type (short delay so it doesn't fire on every keystroke), showing up to 20 matches.
- Clear states: "Searching…", "No clients match.", and "Type at least 2 characters to search."
- The vehicle's current owner is excluded from results, and picking a name still locks in the selection before the Transfer button enables.

## Technical
File: `src/components/vehicles/transfer-ownership-dialog.tsx`
- Drop the `.limit(500)` preload effect and the `useMemo` client-side filter.
- Add a debounced (250ms) effect querying `clients` with `.or(full_name.ilike.%q%,company_name.ilike.%q%)`, `.order("full_name")`, `.limit(20)`, filtering out `vehicle.client_id` in the render.
- Add a `searching` state for the dropdown messages. No backend or policy changes needed.
