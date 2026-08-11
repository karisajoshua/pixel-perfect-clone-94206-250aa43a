# Product classes and sub-classes

Add a proper product classification to quotes and policies: four top-level classes, with sub-classes under Motor Commercial and PSV, plus a tonnage field where it matters.

## Classification

- Motor Private (no sub-class)
- Motor Commercial — Own Goods (tonnes), General Cartage (tonnes), Prime Movers, Institutional Vehicles, Commercial Tuk Tuk, Tankers (liquid carrying), Driving School, Hearse, Ambulance, Agriculture
- Private Motorcycle (no sub-class)
- PSV — Motorcycle PSV (bodaboda), Motor Tuk Tuk (TPO), Tourist Service Vehicle (TSV), Motor PSV Chauffeur Driven (private hire), Motor PSV (Matatu), Motor PSV Unmarked (online), Motor PSV Yellow-Line (TPO)

Behaviour:
- Picking a class shows a second "Sub-class" dropdown only when the class has sub-classes; changing class clears the sub-class.
- Own Goods and General Cartage show a "Tonnage (tonnes)" number input, presented the same way as the PLL field on quotations.
- The two TPO-only sub-classes (Motor Tuk Tuk, Yellow-Line) default the cover type to Third party; since third-party covers carry no levies, the existing no-tax rule then applies automatically.

## Where it appears

- New / edit policy dialog: class + sub-class + tonnage.
- New / edit quote dialog: it currently has no class picker at all — add class, sub-class and tonnage, and carry them over when a quote is converted to a policy.
- Vehicle "Add cover" dialog: currently hardcodes the class to "motor" — replace with the same picker so covers created from a vehicle are classified correctly.
- Policy detail header, policies list, quotation PDF and client portal: show the readable label, e.g. "Motor Commercial — Own Goods (7t)" instead of the raw code.

## Data

One migration adding to both `policies` and `quotations`:
- `product_subclass` text, nullable
- `tonnage` numeric, nullable

Existing rows keep their current `product_class` values (`motor_private`, `motor_commercial`, `psv`, plus 13 legacy `motor` rows). The legacy `motor` rows are normalised to `motor_private`. No sub-class backfill — existing records simply show no sub-class until edited.

## Technical notes

- Central definition file `src/lib/product-classes.ts` exporting the class/sub-class tree, slugs, labels, `hasTonnage`, `tpoOnly`, and a `productClassLabel(class, subclass, tonnage)` helper used by every display surface, so the list lives in one place.
- Sub-class slugs are snake_case: `own_goods`, `general_cartage`, `prime_movers`, `institutional`, `commercial_tuk_tuk`, `tankers_liquid`, `driving_school`, `hearse`, `ambulance`, `agriculture`, `motorcycle_psv`, `tuk_tuk_tpo`, `tsv`, `psv_chauffeur`, `psv_matatu`, `psv_unmarked`, `psv_yellow_line`. New class slug: `private_motorcycle`.
- Save payload allow-lists in the policy and vehicle-cover dialogs get the two new fields; quote-to-policy conversion copies them onto the new policy.
- No CHECK constraint on the new columns (matching how `product_class` is stored today), so future additions stay edit-free.