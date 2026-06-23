## Quotation module updates

### 1. New-quote dialog (`src/routes/_authenticated/quotations.tsx`)

**Client field — typeable combobox**
- Replace the `<Select>` with an `<Input>` + suggestion list (filters loaded clients as you type).
- If the typed name matches an existing client → use that `client_id`.
- If no match → on Save, create a new `clients` row first (`full_name` = typed text, `client_type = "individual"`), then use the returned id. The existing branch-trigger automatically assigns it to the creator's branch.

**Remove Gross premium and Net premium inputs.** Both fields stay in the DB but are computed, not edited.

**Add new inputs**
- `Rate %` (number) — e.g. 3.9
- `Levies` (number, optional) — stored in `line_items.levies`
- `Additional Benefits` — 4 checkbox cards laid out like the second screenshot:
  - Excess Protector Own Damage
  - Excess Protector Theft
  - Political Violence and Terrorism
  - Loss of Use
- Each selected benefit auto-prices at **0.25% × sum_insured**.

**Auto-calculation (live)**
- Base premium = `sum_insured × rate%`
- Benefit premium (each) = `sum_insured × 0.25%`
- `premium_gross` saved = base + sum(benefits)
- `Total` shown = `premium_gross + levies`
- Selected benefits + rate + levies persisted to `quotations.line_items` (jsonb column already exists).

### 2. Quotation PDF (`src/lib/quotation-pdf.ts`)

Rebuild the layout to match the attached ICEA LION format:

- Blue header band: insurer logo/name left, `Quotation provided by: <Insurer>`, `CLIENT NAME: <name>`, `AGENT NAME: ZEST INSURANCE AGENT`.
- Main table with columns: **Class of insurance | Additional benefits | Sum insured | Rate % | Premium | Levies | Total | Remarks**.
  - First row: base cover (e.g. "Motor private Comprehensive") with sum insured, rate, premium.
  - One row per selected additional benefit (name, sum insured, 0.25%, computed premium).
  - Remarks column merges down the right side with the standard cover inclusions (third-party limits, windscreen, towing, medical, etc.) + additional policy details, identical to the screenshot.
  - Bottom row: **Total premium payable** with summed Premium, Levies, Total.
- Blue footer band: policy terms note, contact email/phone, validity ("This quotation is valid for 30 days"), generation timestamp, "Powered by Texcortech Systems".

### 3. Out of scope
- No DB migration (using existing `line_items` jsonb).
- No changes to approval workflow, conversion to policy, or list view.
- Portal-side quotation views untouched.
