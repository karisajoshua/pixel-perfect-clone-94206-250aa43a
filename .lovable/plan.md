## Goal
Show each underwriter's logo on the admin Insurers page (`/admin/insurers`), matched to the insurer row, using the 14 logos already hosted in the Zest Insurance website project.

## Steps

1. **Add `logo_url` column to `insurers` table** (migration)
   - `ALTER TABLE public.insurers ADD COLUMN logo_url text;`
   - No new GRANTs needed (existing table grants cover it).

2. **Copy logo asset pointers from the Zest website project** into `src/assets/insurers/` using `cross_project--copy_project_asset`. Files to copy:
   - AMACO, APA, Britam, CIC, Definite Assurance, Directline, Heritage, ICEA Lion, Kenindia, Kenyan Alliance, Old Mutual, Pacis, Pioneer, The Monarch (14 logos available).
   - The other 7 insurers (Cannon General, Corporate Insurance, Lami, Occidental, Saham, TEBS, Trident) have no logo on the source site — they'll show an initials placeholder.

3. **Seed `logo_url` via migration** — `UPDATE public.insurers SET logo_url = '<cdn-url>' WHERE name = '...'` for each of the 14 matched insurers (using the stable `/__l5e/assets-v1/...` URLs from the copied `.asset.json` files).

4. **Update `src/routes/_authenticated/admin.insurers.tsx`**
   - Add a logo cell (first column) with `<img>` showing `logo_url`, falling back to an `Avatar` with the insurer's initials when null.
   - Add a "Logo URL" field to the `InsurerDialog` so admins can paste/replace logos for the insurers without one (or override later).
   - Include `logo_url` in select / insert / update payloads.

5. **Regenerate Supabase types** — `src/integrations/supabase/types.ts` will be auto-updated by the migration tooling to include the new column.

## Out of scope
- Uploading logos to a storage bucket (we reuse the existing CDN-hosted assets from the website project).
- Showing logos elsewhere (policies list, client portal, etc.) — can be a follow-up once the column exists.

## Technical notes
- Asset pointers live in `src/assets/insurers/*.asset.json`; their `url` field (`/__l5e/assets-v1/{asset_id}/{filename}`) is stable and used directly in the seed migration so the DB doesn't depend on bundler imports.
- Fallback avatar uses the first 2 letters of `name` on a muted background to keep the table tidy when `logo_url IS NULL`.
