## Problem

In `VehicleFormDialog`, the client picker loads at most 500 clients ordered by name (`.limit(500)`) and filters them client-side. Agencies with more than ~500 clients (or names later in the alphabet) can't be found when adding a vehicle. Admins and managers should be able to search the full client database.

## Fix

Update `src/components/vehicles/vehicle-form-dialog.tsx` so the client picker queries the backend as the user types, instead of relying on a one-shot 500-row prefetch:

1. Remove the initial `limit(500)` prefetch of all clients.
2. Add a debounced (~250 ms) query keyed on `clientText` that runs when the dropdown is open and the input has ≥2 characters:
   - `supabase.from("clients").select("id, full_name, company_name, client_type").or("full_name.ilike.%q%,company_name.ilike.%q%").order("full_name").limit(20)`
   - RLS already scopes results correctly — admins/managers see all tenant clients, agents see their branch — so no role branching is needed in the component.
3. Show results in the existing dropdown. Empty state: "No clients match." Loading state: "Searching…". Below 2 chars: hint "Type at least 2 characters to search."
4. Keep the locked-client behavior (when opened from a specific client) and the existing hydration lookup for edit mode (fetch the single selected client by id when `form.client_id` is set but no label yet).
5. Keep `defaultClientId` / `initial` flows unchanged.

## Out of scope

- No schema, RLS, or server-function changes.
- No changes to the Vehicles list page or transfer dialog.
