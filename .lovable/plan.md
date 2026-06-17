## Issue

When editing a vehicle, the list row passed into the form includes a joined `clients` object (from the `select(..., clients(...))` query on the vehicles list). The submit handler spreads the entire row into the update payload, so the request sends a `clients` field — which isn't a column on the `vehicles` table — and Postgres rejects it.

## Fix

In `src/components/vehicles/vehicle-form-dialog.tsx`, sanitize the payload before insert/update so only real vehicle columns are sent:

- Build an explicit whitelist of vehicle fields (client_id, branch_id, registration_no, make, model, year, body_type, color, chassis_no, engine_no, fuel_type, seating_capacity, cubic_capacity, usage_type, estimated_value, inspection_due, notes, active).
- Pick only those keys from `form` into the payload.
- Keep `created_by` only on insert (updates shouldn't overwrite it).

No schema or RLS changes are needed.