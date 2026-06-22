## Goal

Make the client portal feel like a native mobile app on phone screens, while staying usable on desktop.

## Visual model

Two layouts driven by viewport:

- **Mobile (< md)**: app-shell with a top bar (logo + greeting + sign-out menu), full-width scrollable content, and a **fixed bottom tab bar** with 5 primary destinations (Home, Policies, Vehicles, Claims, Profile). Pages get safe-area padding (top notch + bottom tab clearance). Secondary items (Invoices, Documents) move into a "More" sheet opened from the Profile tab or via an overflow on Home.
- **Desktop (≥ md)**: keep today's left sidebar + content layout, unchanged.

## Mobile shell (`src/components/portal/portal-shell.tsx`)

- Slim sticky top bar (h-14): logo left, profile avatar/initial right opening a dropdown with name + Sign out. Drop the horizontal scrolling pill nav.
- Main content gets `pb-24` on mobile to clear the tab bar; `pt-safe`/`pb-safe` via Tailwind arbitrary `env(safe-area-inset-*)`.
- Fixed bottom tab bar (md:hidden, `fixed inset-x-0 bottom-0`), translucent with `backdrop-blur`, top border, 5 icon+label tabs. Active tab uses primary color + small top indicator dot. Tap target ≥ 48px.
- Desktop ≥ md: render existing sidebar shell unchanged.

## Mobile overview page (`src/routes/_portal/portal/index.tsx`)

Restructure for thumb reach and scannability:

- Greeting block: large first-name, small date subtitle ("Mon, Jun 22").
- KPI strip: 2x2 compact tiles on mobile (kpi icon top-right, big value, label below) using `grid-cols-2`; on ≥ sm switch to 4 across.
- Quick actions row: 3-4 rounded square icon buttons (Report claim, Pay invoice, Upload doc, Request service) — horizontal scroll on very narrow widths.
- Recent claims list as full-width rows with chevrons (mobile-app list style), tap to navigate.
- Optional renewal card that stands out only if a renewal is within 30 days.

Desktop layout (≥ md) keeps today's max-w-6xl spacing.

## Theming

Use existing semantic tokens — no hardcoded colors. Tab bar uses `bg-card/80 backdrop-blur border-border`, active state uses `text-primary`.

## Out of scope

No changes to other portal pages' internals — they automatically inherit the new shell and bottom padding. No new routes, no PWA install prompt (can be a follow-up if you want).

## Files touched

- `src/components/portal/portal-shell.tsx` — new mobile top bar + bottom tab bar; desktop branch unchanged.
- `src/routes/_portal/portal/index.tsx` — mobile-first KPI grid, quick actions, list rows.

If you'd like I can also add a "More" bottom sheet for Invoices/Documents on mobile — say the word and I'll fold it in before building.
