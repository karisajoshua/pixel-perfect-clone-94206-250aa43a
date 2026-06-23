## Goal

On the Admin → Insurers page, update logos so:
1. Add/replace logos for Kenindia, Old Mutual, Heritage, and ICEA Lion using the 4 newly uploaded images.
2. All insurer logos display below the insurer name (not inline).
3. Remove the bordered container/box around logos — render as bare images.

## Steps

1. Upload the 4 attached images via `lovable-assets create` from `/mnt/user-uploads/` and write `.asset.json` pointers to `src/assets/insurers/`:
   - `kenindia.png.asset.json`
   - `old-mutual.png.asset.json`
   - `heritage.png.asset.json`
   - `icea-lion.png.asset.json`

2. Run a data update (insert tool) on `public.insurers` to set `logo_url` for those 4 insurers to the new CDN URLs (replacing existing values).

3. Edit `src/routes/_authenticated/admin.insurers.tsx`:
   - Change the Name cell from a horizontal `flex items-center gap-3` (logo + name) to a vertical `flex flex-col gap-2` with name on top and logo below.
   - Remove any border/background/rounded container around the `<img>`; render a plain `<img>` with constrained height (e.g. `h-10 w-auto object-contain`) and no wrapper styling.
   - Keep the initials fallback when `logo_url` is null, also unstyled (plain text, no boxed badge).

No other UI or business logic changes.
