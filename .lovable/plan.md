## Restore Zest's original amber + slate branding

The Zest tenant row was seeded with a red primary (`#dc2626`), and the PDF fallback in code uses a blue primary (`#2563eb`). Both override the original Zest palette (amber `#F59E0B` primary, slate `#1E293B` secondary, yellow `#FACC15` accent) that lives in `src/styles.css`. Non-Zest agencies keep using their own tenant brand values, which is already the behavior.

### Changes

1. **DB migration — reset Zest tenant brand fields** (only the row where `slug = 'zest'`):
   - `brand_primary = '#F59E0B'`
   - `brand_secondary = '#1E293B'`
   - `brand_accent = '#FACC15'`
   
   Other tenants are untouched.

2. **`src/lib/tenant-brand.ts` — fix FALLBACK** so unauthenticated PDF renders (e.g. server-side, or when tenant row is missing) match the original design tokens rather than the current blue defaults:
   - `primary: '#F59E0B'`
   - `secondary: '#1E293B'`
   - `accent: '#FACC15'`

### Result

- Zest dashboard/sidebar re-adopts amber primary on slate sidebar (matches `styles.css` design tokens).
- Zest quotations, invoices, and receipts render with amber headers and slate accents again.
- Other agencies continue to read their own `brand_primary/secondary/accent` from `tenants`, so their PDFs and UI still reflect their configured brand.

### Out of scope

- No changes to the PDF layout, typography, or logo handling.
- No changes to the `TenantBrandProvider` or CSS variables — the fix flows through the existing brand pipeline.
