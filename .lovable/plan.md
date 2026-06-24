# Installable App with Zest Logo

Enable "Add to Home Screen" (Android/iOS) and "Install app" (Chrome/Edge desktop) so the app saves as a shortcut using the uploaded Zest Insurance logo. No offline mode — just installability.

## Steps

1. **Upload the logo as a CDN asset** via `lovable-assets` from the uploaded `mobile_short_cut.png`, generating two icon sizes (192×192 and 512×512 PNGs) plus an Apple touch icon (180×180). Store pointer files under `src/assets/`.

2. **Create `public/manifest.webmanifest`** with:
   - `name`: "Zest Insurance Agency"
   - `short_name`: "Zest"
   - `start_url`: "/"
   - `display`: "standalone"
   - `background_color`: "#1d4ed8" (brand blue from logo)
   - `theme_color`: "#1d4ed8"
   - `icons`: 192, 512 (with `purpose: "any maskable"`)

3. **Wire head tags in `src/routes/__root.tsx`**:
   - `<link rel="manifest" href="/manifest.webmanifest">`
   - `<meta name="theme-color" content="#1d4ed8">`
   - `<link rel="apple-touch-icon" href="...180.png">`
   - `<link rel="icon" ...>` updated to the new logo

4. **No service worker, no `vite-plugin-pwa`** — Lovable's preview guidance forbids app-shell SWs for manifest-only installability.

## How users install

- **Android (Chrome)**: browser shows an "Install app" / "Add to Home Screen" prompt, or via the ⋮ menu → "Install app". Icon appears as the Zest logo.
- **iOS (Safari)**: Share → "Add to Home Screen". Uses the apple-touch-icon.
- **Desktop (Chrome/Edge)**: install icon appears in the address bar; installs as a windowed app with the Zest logo.

Note: install prompts only appear on the **published** site (https://app.zestinsurance.co.ke or the lovable.app domain), not inside the Lovable editor preview.

## Files to change

- New: `src/assets/zest-icon-192.png.asset.json`, `zest-icon-512.png.asset.json`, `zest-icon-180.png.asset.json`
- New: `public/manifest.webmanifest`
- Edit: `src/routes/__root.tsx` (head links/meta)
