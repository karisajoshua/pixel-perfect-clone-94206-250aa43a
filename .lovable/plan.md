Replace the current client dropdown in `src/components/policies/policy-form-dialog.tsx` with a searchable typeahead that queries the full clients database — same pattern already used in the vehicle and invoice forms.

## Changes

- `src/components/policies/policy-form-dialog.tsx`
  - Remove the pre-fetched `clients` list + `<Select>`.
  - Add a Combobox/Popover + Command input with server-side debounced search against `clients` (by `full_name`, `company_name`, `email`, `phone`) — limit ~20 results.
  - When editing an existing policy or renewing, fetch the currently linked client once so its name renders in the trigger.
  - Keep vehicle dropdown behavior (still filtered by selected client_id).
  - Preserve existing save logic and the post-save policy-issued email fetch.

No schema or RLS changes — the widened `clients` SELECT policy already lets admins/managers/agents search agency-wide.