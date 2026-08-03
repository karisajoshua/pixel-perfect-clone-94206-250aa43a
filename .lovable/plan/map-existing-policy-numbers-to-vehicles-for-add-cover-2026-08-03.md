# Map existing policy numbers to vehicles for "Add cover"

## What the data shows

I checked the records first:

- 992 vehicles; 269 already have a policy attached, 723 do not.
- Only 8 policies in the system are not attached to any vehicle (9 vehicles could be filled from those).
- Of the 723 vehicles without cover, only 65 belong to a client who has any policy at all. The other 658 belong to clients with no policy recorded anywhere — there is no policy number in the system to show for them.

So "map everything" is possible for the 65 vehicles whose owner already has a policy; the rest need the cover details entered or imported.

## What changes

**1. One-off backfill (data fix)**
- Where a client has an unattached policy and exactly one vehicle, attach that policy to the vehicle. Ambiguous cases (client has several vehicles) are left alone so no car gets the wrong cover.

**2. Add cover prefills from any policy the client has**
- Current behaviour: prefills only from a policy attached to this vehicle, or an unattached client policy.
- New: if neither exists, fall back to the client's most recent non-cancelled policy even when it is attached to another vehicle. Only the reusable fields are prefilled — policy number, certificate number, insurer, term, commencement, expiry.
- This case is clearly labelled ("Copied from PRN-1234 on KAA 123A — check before saving") with a Clear link.
- Saving in this case creates a new policy row for this vehicle; it never moves cover off the other vehicle.

**3. Card strip**
- Vehicles whose client has a policy but no own cover keep showing "No active cover — add cover"; the prefill happens when the dialog opens.

## Technical notes

- Migration: `UPDATE policies p SET vehicle_id = v.id` for unattached policies where the client has exactly one vehicle and that vehicle has no policy.
- `src/components/vehicles/vehicle-form-dialog.tsx`: extend the cover lookup to a third step (client's latest policy regardless of `vehicle_id`), tracked as `copiedFromCover` state distinct from `coverId`/`suggestedCoverId`; save path for that state uses insert, not update.
