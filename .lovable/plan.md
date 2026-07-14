## Goal
Replace the raw JSON `<pre>` dumps in the IPEN services explorer (`/admin/ipen`) and the two portal widgets with properly rendered tables/cards driven by the actual JSON shape returned from each endpoint.

## Scope (surfaces to update)
1. `src/routes/_authenticated/admin.ipen.tsx` — `JsonPanel`, `PaymentTab` result, `OcrTab` result, `AssistantTab` result.
2. `src/components/ipen/portal-dashboard-widget.tsx` — dashboard tiles instead of JSON.
3. `src/components/ipen/policy-live-drawer.tsx` — grouped detail sections.
4. Reference-data explorer already renders as tables — leave alone.

## Approach
Create one small shared helper module `src/lib/ipen/render.tsx` with:
- `unwrap(data)` — handles `{ data: [...] }` / `{ data: {...} }` / raw shapes.
- `<AutoTable rows humanize />` — generic table that infers columns from the first row's keys, prettifies headers ("firstName" → "First name"), formats dates/numbers/booleans, truncates long strings.
- `<KeyValueGrid obj />` — 2-column grid for object payloads (profile, portal dashboard summary, claim/policy detail).
- `<SmartRender data />` — picks table vs key-value vs empty-state vs error automatically.
- Small helpers: currency (KES), date (dd MMM yyyy), status pill.

## Per-tab rendering
- **Policies**: AutoTable of `policyNumber, product, coverType, startDate, endDate, premium, status` (fallback to inferred columns).
- **Claims**: AutoTable of `claimNumber, policyNumber, dateOfLoss, status, amount`.
- **Customer vehicles**: AutoTable of `registrationNumber, make, model, year, use, chassis`.
- **Profile**: KeyValueGrid grouped into "Personal" / "Contact" / "IDs".
- **Portal dashboard**: stat cards for numeric top-level fields + AutoTable for any embedded arrays.
- **M-Pesa result**: KeyValueGrid (CheckoutRequestID, MerchantRequestID, ResponseDescription, CustomerMessage) + success pill.
- **OCR result**: KeyValueGrid of extracted fields.
- **Assistant**: render `reply.message` / `reply.answer` as prose; only fall back to JSON if unknown shape.
- **Policy live drawer**: header block (policy number + status pill) + KeyValueGrid + nested tables for `insuredItems` / `payments` / `documents` if present.
- **Portal widget**: compact stat tiles (counts) instead of JSON.

## Fallback
When a payload doesn't match any known key, SmartRender falls back to a collapsible "Raw data" `<details>` block so nothing is lost. Errors keep the existing red banner.

## Out of scope
- Server function payloads — no changes.
- Reference data explorer — already tabular.
- Column configuration UI, sorting, filtering, pagination (can add later if needed).

## Verification
- Load `/admin/ipen`, cycle through all 8 service tabs, confirm tables render and no `[object Object]` cells.
- Open a policy live drawer and the portal dashboard widget; confirm no raw JSON visible.
- Typecheck passes.
