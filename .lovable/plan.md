## Changes

### 1. Quotation dialog — Third-party fixed premium (`src/routes/_authenticated/quotations.tsx`)

Comprehensive uses `sum_insured × rate %`, but Third Party and TPFT are typically flat premiums with no sum insured. Update `QuoteDialog` so when `cover_type` is `third_party` or `third_party_fire_theft`:

- Hide the Sum insured and Rate % inputs.
- Show a single "Premium (KES)" input bound to a new `line_items.flat_premium` field.
- Recompute totals: `basePremium = flat_premium`, `benefitPremium = 0` (benefits section also hidden for third-party since it's sum-insured-based), `levies = premiumGross × 0.0045 + 40`, `total = premiumGross + levies`.
- Persist `premium_gross = flat_premium`, `premium_net = flat_premium`, `sum_insured = null`, `line_items = { flat_premium, levies }`.

Comprehensive behavior stays exactly as it is today.

### 2. Vehicle dialog — Searchable client (`src/components/vehicles/vehicle-form-dialog.tsx`)

Replace the client `<Select>` (only shown when `lockedClient` is null) with the same searchable typeahead pattern already used in `QuoteDialog`:

- Text input with client name; dropdown of up to 8 matches filtered by typed text.
- Selecting a suggestion sets `form.client_id`.
- Unlike the quote dialog, this does NOT auto-create a new client — Save stays disabled until an existing client is picked (matches current required-client behavior).
- Locked-client mode (when opened from a client detail page) remains a read-only input, unchanged.

No schema changes, no other files touched.
