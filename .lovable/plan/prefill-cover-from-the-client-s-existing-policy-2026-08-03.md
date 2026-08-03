# Prefill cover from the client's existing policy

When you click "Add cover" on a vehicle that has no policy of its own, the dialog should look up policies already recorded under that client and prefill the cover fields instead of opening blank.

## What changes

- Vehicle dialog cover lookup becomes two-step:
  1. A policy already linked to this vehicle (current behaviour) — prefill and edit it on save.
  2. If none, the client's most recent non-cancelled policy that is not attached to any other vehicle — prefill policy number, certificate number, commencement, expiry, insurer and term.
- In case 2 the fields are shown as a suggestion from the client's record, with a short note ("Prefilled from this client's policy PRN-1234 — saving will link it to this vehicle") and a "Clear" link so staff can start blank.
- On save in case 2, the existing policy row is updated with any edits and linked to this vehicle, rather than creating a duplicate policy.
- If the client's only policies are already attached to other vehicles, nothing is prefilled (avoids copying another car's cover), and the dialog behaves as today.

## Technical notes

- `src/components/vehicles/vehicle-form-dialog.tsx`: extend the cover-loading effect — after the `vehicle_id` query returns nothing, query `policies` by `client_id`, `status <> 'cancelled'`, `vehicle_id is null`, ordered by `start_date` desc, limit 1. Track its id in a new `suggestedCoverId` state distinct from `coverId`.
- Save path: when `suggestedCoverId` is set and cover fields are non-empty, `update` that policy with the cover payload plus `vehicle_id`, instead of the insert branch.
- Invalidate `client-vehicles` as today so the card strip refreshes.
