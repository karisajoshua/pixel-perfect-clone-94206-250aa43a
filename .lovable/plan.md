## Restore Zest's original blue branding (matches uploaded quotation)

The uploaded reference PDF shows the correct Zest palette is a bright blue header/footer with a deep-blue accent — not the amber/slate I applied last turn. Revert Zest to blue across the tenant record, the code fallback, and the app UI tokens.

### Colors (from the reference)

- Primary: `#2563EB` (blue header/footer, table header, accent text)
- Secondary: `#1E3A8A` (deep blue for totals / dark accents)
- Accent: `#F59E0B` (amber highlight, e.g. buttons)

### Changes

1. **Data update on `tenants` row where `slug = 'zest'`**
   - `brand_primary = '#2563EB'`
   - `brand_secondary = '#1E3A8A'`
   - `brand_accent = '#F59E0B'`
   Other agencies untouched.

2. **`src/lib/tenant-brand.ts` FALLBACK** — restore to blue defaults:
   - `primary: '#2563eb'`, `secondary: '#1e3a8a'`, `accent: '#f59e0b'`

3. **`src/styles.css`** — swap the "Zest Citrus" amber/slate tokens for blue so the default app UI (before `TenantBrandProvider` overrides) reflects Zest's real brand:
   - `--primary` and `--ring` → blue (oklch equivalent of `#2563EB`)
   - `--sidebar` → deep blue (oklch equivalent of `#1E3A8A`) with light foreground
   - `--sidebar-primary` / `--sidebar-ring` → blue primary
   - `--accent` → amber wash
   - Chart tokens re-anchored so `chart-1` reads blue
   - Dark-mode tokens unchanged (already neutral)

### Result

- Zest quotations, invoices, receipts render with the blue header + soft-blue table styling shown in the uploaded PDF.
- Zest dashboard/sidebar shows the blue primary on a deep-blue sidebar.
- Other agencies continue to use their own `brand_primary/secondary/accent` from `tenants`, so their PDFs and UI are unaffected.

### Out of scope

- No layout, typography, or logo changes to the PDFs.
- No changes to `TenantBrandProvider` — the fix flows through existing brand plumbing.
