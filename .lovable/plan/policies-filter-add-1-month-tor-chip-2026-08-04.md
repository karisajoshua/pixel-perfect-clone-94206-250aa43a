# Policies filter: add "1 month TOR" chip

## What changes

On the Policies list, add a new filter chip **1 mo TOR** next to the existing chips. Clicking it shows only policies whose term is `tor` (1 month / Term of Restriction).

The chip list becomes: `all`, `active`, `pending`, `expired`, `cancelled`, `rop`, `tor`.

## Technical detail

In `src/routes/_authenticated/policies.tsx`:

- Add `"tor"` to the chip array: `["all", "active", "pending", "expired", "cancelled", "rop", "tor"]`.
- In the chip label logic, map `tor` → `"1 mo TOR"`.
- In the query, add a branch: when `status === "tor"`, apply `.in("policy_term", ["tor"])` (i.e. only TOR-term policies), skipping the status `.eq()` filter — same pattern already used for `rop`.
- Keep the existing `rop` branch (`six_months`, `annual`) unchanged.
