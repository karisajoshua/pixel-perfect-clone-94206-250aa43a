# Make every agency fully independent (branding, documents, payment details)

## What's wrong today

Verified in the code and database:

- The three agencies in the database each hold their own colours (Zest blue, Britam, ZYTA) — no agency has overwritten another's stored colours. The leak is in the browser: `src/lib/tenant-brand.ts` caches the brand in a module-level variable that is never cleared on sign-in/sign-out (`resetBrandCache` exists but is never called anywhere). So in a tab where one agency was active, the next agency (or Zest) keeps using the previously loaded brand until a hard refresh.
- Documents are hardcoded to Zest:
  - Quotation PDF prints Zest's Safaricom Till 603830, KCB Paybill 522533, Account 1211118266 for every agency.
  - Quotation and receipt PDFs always stamp the Zest company stamp image.
  - Invoice and receipt PDFs fall back to the Zest logo when an agency has no logo.
  - When an agency leaves contact fields blank, the fallback fills in Zest's address, phone, email and website.

## What will change

### 1. Per-agency document profile (new settings)

Add to each agency record: website, M-Pesa till, paybill, paybill account, bank name, bank branch, bank account name, bank account number, company stamp image, and an optional document footer note.

Agency admins/managers edit these in **Agency settings**, in two new cards:
- **Payment details** — the fields above, shown exactly as they will print on quotations and invoices.
- **Company stamp** — upload a PNG/JPG stamp (stored privately per agency, same as the logo).

### 2. Documents use only that agency's data

Quotation, invoice and receipt PDFs will read the signed-in agency's name, tagline, address, phone, email, website, logo, stamp and payment details.
- The payment block prints only the lines the agency actually filled in; if none are set, the block is skipped instead of showing Zest's numbers.
- No logo → the agency's name is printed in the header (no Zest logo).
- No stamp → the stamp area is left blank (no Zest stamp).
- Zest keeps its current look: its payment details and stamp are seeded into its own agency record as part of this change, so nothing regresses.

### 3. Colour isolation

- Clear the cached brand on sign-in, sign-out and agency switch, so colours and document details can never carry over from the previously signed-in agency.
- Reset the injected theme variables when no brand is loaded, so the base Zest palette only applies to signed-out pages.

### 4. Applies to all onboarded agencies

The new fields default to empty for existing agencies, so Britam and ZYTA immediately stop printing Zest's numbers/stamp and can fill in their own in Agency settings. Zest's row is backfilled with its current details so its documents are unchanged.

## Technical notes

- Migration: add `website`, `mpesa_till`, `mpesa_paybill`, `paybill_account`, `bank_name`, `bank_branch`, `bank_account_name`, `bank_account_no`, `stamp_url`, `doc_footer_note` to `public.tenants`; backfill the Zest row with today's hardcoded values.
- New `setTenantStamp` server function mirroring `setTenantLogo` (path must start with `<tenant_id>/`, long-lived signed URL from the `tenant-brand` bucket).
- Extend `MyTenant`/`TenantBrand` types, `getMyTenant`, `updateMyTenant` (whitelisted new fields), and `getCurrentBrand` in `src/lib/tenant-brand.ts` — drop the Zest string fallbacks, return nulls, and let PDFs skip missing pieces.
- `src/lib/quotation-pdf.ts`, `src/lib/invoice-pdf.ts`, `src/lib/receipt-pdf.ts`: replace the `stampAsset`/`logoAsset` fallbacks and hardcoded payment strings with brand values; payment panel height computed from the number of populated lines.
- Call `resetBrandCache()` from the auth state change handler in `src/routes/__root.tsx` and on sign-out.