## Goal
Make `/` show the auth page directly, and add a rotating background image carousel on the brand side of the split-screen layout.

## Changes

**1. Route restructure**
- Replace `src/routes/index.tsx` (current marketing landing) with the auth page UI — `/` renders sign-in / sign-up.
- Delete `src/routes/auth.tsx` and update all references (`navigate({ to: "/auth" })`, `redirect({ to: "/auth" })`, `<Link to="/auth">`) to point to `/` instead. Affected files:
  - `src/routes/_authenticated/route.tsx` (redirect on unauthenticated)
  - `src/components/app-shell.tsx` (sign-out redirect)
  - `src/routes/reset-password.tsx` (if it links back)
- Authenticated users hitting `/` are redirected to `/dashboard` (same behavior auth page has today).

**2. Rotating background carousel**
- Generate 3 insurance-themed photos (e.g. Nairobi cityscape at dusk, family with car keys, motorbike on coastal highway) saved to `src/assets/auth-bg-{1,2,3}.jpg`.
- Replace the left brand panel content with a stacked image layer: all 3 images absolutely positioned, fading in/out on a 6s interval via a small `useEffect` + state index. Apply a dark gradient overlay so the Zest logo + tagline remain readable on top.
- Keep the right column (auth card) unchanged in structure.

**3. Cleanup**
- Remove the marketing landing entirely (features grid, hero, header). No `/about` move.

## Technical notes
- Image carousel: pure CSS opacity transition (`transition-opacity duration-1000`) driven by a single index state — no carousel library.
- Use `<img>` with `loading="eager"` on the first slide, `loading="lazy"` on the rest, and proper `alt` text.
- Images generated via `imagegen` (fast tier, 1024x1536 portrait to fit the tall split panel), stored under `src/assets/`.
- Route file: `createFileRoute("/")` keeps its existing head() but with auth-focused title/description.
