# Vehicles moved under Clients

Vehicles stop being a top-level sidebar page and become a tab inside each client's page, showing every vehicle that client owns together with its cover details.

## What changes

**Sidebar**
- Remove the "Vehicles" entry. The standalone `/vehicles` page is deleted; all vehicle work happens from a client.

**Client page — new "Vehicles" tab**
- Sits alongside Overview / KYC / Documents / Communications.
- Lists all vehicles for that client (no limit), one expandable card per vehicle.
- Card header: registration number, make/model/year, usage type, active/inactive badge.
- Vehicle details: chassis no., engine no., body type, colour, fuel, seating, cubic capacity, estimated value, inspection due / next inspection.
- Actions per vehicle: Edit (existing vehicle dialog), Transfer ownership (admin/manager only, existing dialog).
- "New vehicle" button on the tab, pre-filled with this client.

**Cover details per vehicle**
For each vehicle the tab shows its policies with:
- Certificate number (new field, see below)
- Policy number and insurer
- Commencement date and expiry date
- Policy term (TOR / one month extendable / 6 months / annual)
- Status, including cancelled — with cancellation date and reason shown inline
- Payment extensions on that policy: amount due, due date, status (pending / paid / overdue), reason
- Balance due where present

Vehicles with no policy show "No cover on record".

## Certificate number

`certificate_no` is added as a new text field on policies (the motor certificate issued by the insurer, distinct from the policy number). It becomes an optional field in the new/edit policy form and displays on the client vehicles tab, the policy detail page and the policy list.

## Technical notes

- Migration: `ALTER TABLE public.policies ADD COLUMN certificate_no text;` plus an index on `(tenant_id, certificate_no)`.
- New component `src/components/clients/client-vehicles.tsx`, rendered from a new tab in `src/routes/_authenticated/clients.$id.tsx`.
- One query per client: vehicles for the client, each with nested `policies(...)` (policy_no, certificate_no, start_date, end_date, status, policy_term, balance_due, cancelled_at, cancellation_reason, insurers(name)) and `policy_payment_extensions` fetched for those policy ids.
- Reuses `VehicleFormDialog` and `TransferOwnershipDialog` as-is.
- Delete `src/routes/_authenticated/vehicles.tsx` and drop the nav item in `src/components/app-shell.tsx`; any in-app links to `/vehicles` are repointed to the client page.
