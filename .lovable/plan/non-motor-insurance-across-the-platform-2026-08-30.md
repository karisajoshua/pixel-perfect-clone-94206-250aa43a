# Non-motor insurance across the platform

Today every quote and policy is shaped around a vehicle: the quote and policy dialogs always ask for a vehicle, `src/lib/product-classes.ts` only contains the four motor classes, and the premium maths in the quote dialog is fixed to sum-insured x rate plus the motor excess/PLL/PA benefits. This adds general non-motor business alongside motor, for every tenant, without disturbing the motor flow.

## Lines of business to add

Grouped into two categories in the product picker: **Motor** (unchanged) and **Non-Motor**.

- Fire & Property — Fire Domestic, Fire Industrial/Special Perils, Burglary, All Risks, Money, Electronic Equipment, Machinery Breakdown, Business Combined
- Liability — Public Liability, Product Liability, Professional Indemnity, Directors & Officers
- Accident & Health — Personal Accident, Group Personal Accident, WIBA, WIBA Plus, Medical (Individual / Corporate), Last Expense
- Marine & Goods — Marine Cargo, Goods in Transit
- Engineering — Contractors All Risks, Erection All Risks, Contractors Plant & Machinery
- Bonds — Performance Bond, Bid Bond, Customs Bond, Immigration Bond
- Travel
- Domestic Package
- Agriculture — Crop, Livestock

Each class declares what it needs: which risk fields to capture, how the premium is rated, whether a cover-type picker applies, and which levies apply.

## How a non-motor quote will work

1. Staff pick a category and class as they do now; sub-class list adapts.
2. The **Vehicle** picker only shows for motor classes. Non-motor classes instead show a short **Risk details** block generated from the class definition — for example Fire Industrial asks for location/address, building description and sum insured breakdown; WIBA asks for number of employees and annual wage bill; Marine Cargo asks for voyage from/to, cargo description and conveyance; Medical asks for number of members and the inpatient/outpatient limits.
3. **Rating mode** per class:
   - *Rate on sum insured* (Fire, Burglary, All Risks, Engineering, Marine) — sum insured x rate %, with optional per-section rows.
   - *Flat/quoted premium* (Bonds, Travel, Liability limits of indemnity) — staff type the premium.
   - *Per unit* (WIBA on wage bill, GPA per member, Medical per member) — unit count x rate/premium per unit.
   - Motor keeps its existing maths untouched.
4. **Levies** follow the class: general non-life keeps PHCF 0.25% + training levy 0.2% + KES 40 stamp (same formula used today); Medical and Life-style classes and third-party motor stay levy-free. The computed levy stays editable.
5. Everything downstream — quote PDF, convert-to-policy, invoice, receipt, renewals, portal — works unchanged, but displays the risk description (e.g. "Fire Industrial — Godown, Industrial Area") wherever it currently prints a vehicle registration.

## Documents / KYC

Non-motor clients need different attachments: valuation report, business permit, employee schedule, stock declaration, contract/BQ, bill of lading, medical member list. These get added to the per-client and per-cover document types so KYC is meaningful for non-motor too.

## Where it shows up

- New/edit quote dialog and new/edit policy dialog — category + class + sub-class, risk fields, rating block.
- Client detail — a **Covers** area next to Vehicles listing non-motor policies for that client (vehicles stay as they are).
- Policies list, policy detail header, renewals search, quotation and policy PDFs, client portal cards — show the risk label rather than "—" where there is no vehicle.
- Reports and dashboard — premium split by category (motor vs non-motor) and by class.
- Available to all tenants by default; no per-tenant enablement switch unless you want one later.

## Data changes

One migration, additive only:

- `quotations` and `policies`: add `risk_details jsonb not null default '{}'` (the class-specific answers) and `risk_label text` (the human summary used in lists and PDFs).
- Existing `product_class` / `product_subclass` / `tonnage` columns are reused as-is; the new classes are just new slug values, so no backfill and no motor record changes.
- No new tables — a non-motor risk lives on the quote/policy that covers it, the way a vehicle-less cover already can.
- New KYC document types added to the existing document-type list.

## Technical notes

- `src/lib/product-classes.ts` becomes the single registry: each class gets `category`, `ratingMode`, `coverTypes`, `leviesApply`, and a `riskFields` array (key, label, input type, required). `productClassLabel()` gains a `riskLabel()` companion used by every display surface.
- A new `src/components/risk-details-fields.tsx` renders `riskFields` generically, mirroring how `ProductClassFields` is shared today, so quote, policy and future dialogs all use one component.
- A new `src/lib/premium-calc.ts` extracts the premium/levy maths currently inline in `quotations.tsx` and dispatches on `ratingMode`; motor's existing branch is moved across unchanged so current quotes compute identically.
- Save payload allow-lists in the quote and policy dialogs gain `risk_details` and `risk_label`; quote-to-policy conversion copies both.
- IPEN stays motor-only for now — the live-quote wizard is hidden for non-motor classes rather than being wired to their non-motor endpoints.
