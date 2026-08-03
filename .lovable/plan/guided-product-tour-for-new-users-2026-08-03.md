# Guided product tour for new users

Give first-time users a world-class walkthrough: a welcome dialog, then step-by-step spotlight tooltips that highlight exactly where to click, module by module. Users can skip at any time, and once finished the overlay never comes back.

## What the user sees

1. **Welcome dialog on first login** — "Welcome to <Agency name>. Take a 2-minute tour?" with Start tour / Skip for now / Don't show again.
2. **Spotlight tour** — dimmed overlay with a cutout around the highlighted element and a small card showing a step counter (e.g. 3 of 12), a short title, one line of guidance, and Back / Next / Skip tour. Arrow keys and Esc work; the tour scrolls each target into view.
3. **Multi-page flow** — the tour navigates between modules itself, in natural work order:
   - Dashboard: what the metric cards mean
   - Clients: Add client, search, then the client detail tabs (Vehicles, KYC, Documents)
   - Quotations: New quote, cover types, convert to policy
   - Policies: policy detail, cover terms, payment extensions, cancellation
   - Invoices: create invoice, download PDF with QR verification
   - Claims: file a claim
   - Renewals and Reports: at a glance
   - Admin only: Users & Roles, Branches, Agency & Brand
4. **Role-aware** — steps whose target isn't available to that role are skipped automatically.
5. **Completion** — a short "You're all set" card, then the overlay disappears permanently for that user.
6. **Restart any time** — a "Take the tour" item in the account menu and beside the existing setup checklist.
7. **Client portal** — a shorter 5-step version covering Overview, Policies, Vehicles, Invoices, Claims.

## Technical approach

- Add `driver.js` and wrap it in `src/components/tour/tour-provider.tsx`, exposing `useTour()` with `start(tourId)`, `stop()`, and completion state. Popover restyled with existing design tokens so it matches the app rather than looking like a stock library.
- Step definitions in `src/components/tour/tour-steps.ts` as data: `{ id, path, selector, title, body, roles? }`. Cross-page steps drive `router.navigate` and wait for the target to mount before advancing.
- Anchors: add `data-tour="clients-nav"`-style attributes to sidebar links, mobile tabs, primary action buttons, and key tab lists. Presentation-only, no logic changes.
- Progress: new `public.user_tour_progress` table (`user_id`, `tour_id`, `status`, `last_step`, `completed_at`) with RLS + GRANTs scoped to `auth.uid()`, read/written through server functions in `src/lib/tour.functions.ts`. `localStorage` acts as an instant-read cache so the overlay never flashes on reload.
- Mount `<TourProvider>` inside `src/components/app-shell.tsx` and `src/components/portal/portal-shell.tsx`; auto-start only when no completed/skipped record exists.
- Mobile: anchor to the bottom tab bar and center the popover instead of arrow-anchoring.