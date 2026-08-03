# Vehicle cover details on the client page

Each vehicle under a client shows its active cover at a glance, and staff can fill in that cover information from the vehicle dialog when it is missing.

## What changes

**Client page**
- The Communications tab is removed (Overview / Vehicles / KYC / Documents remain).

**Vehicle card — active cover summary**
- Each vehicle card header gains a compact cover strip showing the active policy's:
  - Policy number
  - Certificate number
  - Commencement date
  - Expiry date
- "Active" means status active and today within start/end dates; if none, the most recent policy is shown and labelled, and vehicles with no policy show "No active cover — add cover".
- The existing full per-policy list below stays as-is.

**Vehicle dialog — Cover section**
- The new/edit vehicle dialog gains a "Cover details" section with: policy number, certificate number, commencement date, expiry date, insurer, and policy term.
- When the vehicle already has an active policy, the fields are pre-filled and saving updates that policy.
- When there is no policy, filling these fields creates a policy record for that vehicle and client so the information is mapped and shows on the card.
- Cover fields are optional; leaving them blank saves the vehicle only.

## Technical notes

- `src/routes/_authenticated/clients.$id.tsx`: drop the `comms` TabsTrigger/TabsContent and the `ClientCommunications` import (component file kept, unused elsewhere check first).
- `src/components/clients/client-vehicles.tsx`: derive `activePolicy` per vehicle and render the summary strip; query already selects `policy_no, certificate_no, start_date, end_date, status`.
- `src/components/vehicles/vehicle-form-dialog.tsx`: add cover state, load the vehicle's active policy on open, and on save upsert into `policies` (insert requires client_id, vehicle_id, policy_no, start_date, end_date, product_class `motor`, cover_type, status; tenant/branch are set by existing triggers). Invalidate `client-vehicles` so the card refreshes.
- No schema change needed — `certificate_no` and `policy_term` already exist on `policies`.
