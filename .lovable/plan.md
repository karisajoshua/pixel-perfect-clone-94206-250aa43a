# Authorized signatory per agency

## What changes

Instead of hardcoding a name on receipts, each agency stores its own authorized signatory in **Agency settings**, and receipts print that name above the words "Authorized Signatory".

### 1. New agency setting

Add two fields to the agency record:
- **Authorized signatory name** (e.g. Elizabeth Grace)
- **Signatory title** (optional, e.g. Finance Manager) — printed under the name when set

These appear in Admin → Agency, in the **Company stamp** card (renamed to "Company stamp & signatory"), so the stamp and the signing name live together.

### 2. Receipts use it

The "AUTHORIZED BY" panel on the receipt prints:
- the agency's signatory name on the signature line (falling back to the staff member who recorded the payment if no signatory is set, which is today's behaviour),
- the signatory title, when set, in place of the generic "Authorized Signatory" caption; otherwise "Authorized Signatory" stays.

Zest's record is seeded with **Elizabeth Grace** so your receipts show that name immediately. Other agencies start blank and fill in their own.

## Technical notes

- Migration: add `signatory_name text` and `signatory_title text` to `public.tenants`; backfill the Zest row with `Elizabeth Grace`.
- `src/lib/tenants.functions.ts`: extend `MyTenant` type and the `updateMyTenant` whitelist/zod schema.
- `src/lib/tenant-brand.ts`: add `signatory_name` / `signatory_title` to `TenantBrand` and `getCurrentBrand`.
- `src/routes/_authenticated/admin.tenant.tsx`: two inputs in the stamp card.
- `src/lib/receipt-pdf.ts` (lines ~304-307): use `brand.signatory_name || receivedBy || ""` on the line, and `brand.signatory_title || "Authorized Signatory"` as the caption.
