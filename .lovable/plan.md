## Goal
Rebuild `src/lib/receipt-pdf.ts` so the receipt matches the invoice/quotation brand (blue `#2563eb` / `#1e3a8a`) instead of orange, and reorganize the layout into a clean, premium document.

## Color tokens (match invoice-pdf.ts / quotation-pdf.ts)
- `BRAND = #2563eb` (primary)
- `BRAND_DARK = #1e3a8a` (accents, totals)
- `BRAND_SOFT = #eaf2ff` (table band, card fills)
- `MUTED = #6b7280`, `BORDER = #e5e7eb`, `INK = #111827`
- Status pill: green `#047857` for PAID IN FULL, amber `#b45309` for PARTIAL — never orange brand accents.

## Layout (A4 portrait, matches invoice/quote feel)

```text
┌───────────────────────────────────────────────────────────┐
│ [logo] ZEST INSURANCE AGENCY            OFFICIAL RECEIPT  │  ← thin blue rule under header
│        Insurance Brokerage & Advisory   No. RCP-2026-XXXX │
│        Ruai · +254… · info@…            Date: 28 Jun 2026 │
├───────────────────────────────────────────────────────────┤
│ RECEIVED FROM                 │ PAYMENT FOR               │  ← two soft-blue cards
│ Client name                   │ Invoice INV-…             │
│ phone · email                 │ Policy POL-…              │
│ Branch                        │ Issued / Due dates        │
├───────────────────────────────────────────────────────────┤
│ AMOUNT RECEIVED                                           │
│   KSH 12,500.00       [ PAID IN FULL ] (green) or         │
│   Kenya Shillings Twelve Thousand … Only                  │  ← single full-width band, brand blue
├───────────────────────────────────────────────────────────┤
│ Payment details table (brand-blue header)                 │
│  Date | Method | Reference | Invoice | Policy | Amount    │
├───────────────────────────────────────────────────────────┤
│ Summary table (right, ~55% width)   │ Authorized by panel │
│  Invoice total                      │  Signature line     │
│  Previously paid                    │  Name / role        │
│  This payment        (brand row)    │  [stamp image]      │
│  Total paid                         │                     │
│  Balance due       (BRAND_DARK row) │                     │
├───────────────────────────────────────────────────────────┤
│ Notes / terms (small, muted)                              │
│ Footer: thin brand rule + "Thank you …" centered          │
└───────────────────────────────────────────────────────────┘
```

## Implementation notes
- Reuse the visual grammar from `invoice-pdf.ts`: thin top brand bar, `autoTable` with `headStyles.fillColor = BRAND`, alternating `#fafafa` rows, soft-blue info cards with `#eaf2ff` fill + `BORDER` stroke.
- Remove all orange fills, triangles, circular icon badges, the angled footer band, and the unicode glyphs (☎ ✉ ⌘ ◉ ☰) — they render inconsistently. Use plain bold labels (`Phone`, `Email`, `Web`).
- Keep helpers already in the file: `loadImage`, `kesInWords`, `deriveReceiptNo`, `money`. No signature/API changes — call sites in `src/routes/_authenticated/invoices.$id.tsx` and `src/routes/_portal/portal/invoices.$id.tsx` keep working unchanged.
- Stamp image: place inside the "Authorized by" panel at ~90×90, right-aligned.
- Status pill uses green/amber per state, never the brand blue (so it stands out without clashing).
- Single page; if content overflows on edge cases, let autoTable paginate naturally.

## File touched
- `src/lib/receipt-pdf.ts` — full rewrite of the rendering body; exports unchanged.

No other files, no schema, no business logic changes.