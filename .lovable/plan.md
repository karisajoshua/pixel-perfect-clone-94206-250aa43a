# Make manual vehicle entry work properly

## Goal
Staff can fill in every vehicle log book detail by hand (no scan needed), pick an insurance company from a dropdown that opens in the right place, and save the vehicle and its cover successfully, on both phone and desktop.

## Steps
1. **Reproduce first.** Open the Add vehicle form in the preview on desktop and phone sizes. Type into every field (registration, make, model, year, colour, chassis, engine, fuel, usage, seats, cc, value). Open the insurer, branch, term and class dropdowns. Then save. Record exactly which fields won't accept typing and where the insurer list appears.
2. **Fix typing problems** in the log book fields so each one keeps what's typed, including number fields and dates, and fields filled by a scan can still be edited.
3. **Fix the insurer dropdown position.** Make the dropdown open directly under its box and stay inside the screen and form, even when the form is scrolled or on a phone. Apply the same fix to the other dropdowns in the form.
4. **Make manual entry obvious.** Add a short note by the scan button: "Scan failed or no log book? Type the details below." A failed scan should never clear or lock the fields.
5. **Compare insurers fallback.** No insurer rates are set up yet, so comparing returns nothing. When that happens, show a clear message and let staff pick the insurer by hand in Cover details. No rates will be made up.
6. **Check it end to end.** Add a vehicle with cover by hand, confirm it shows on the client's Vehicles tab, then edit it again. Test at phone and desktop sizes.

## Technical details
- File: `src/components/vehicles/vehicle-form-dialog.tsx`. The dialog uses `max-h-[90vh] overflow-y-auto`. Give the Select content `position="popper"` with collision padding and a max height, and check the `F` input helper's controlled value handling for number and null values.
- No changes to the backend, pricing, DMVIC or saving logic beyond fixing what breaks.
- Run the typecheck and a Playwright check before reporting back.
