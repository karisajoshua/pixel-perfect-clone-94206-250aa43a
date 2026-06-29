## Goal
When admin, manager, or agent users open the app on a phone or tablet, the staff workspace should feel like a native mobile app — matching the polish the client portal already has — instead of a shrunken desktop site.

## Scope
Only the staff shell (`src/components/app-shell.tsx`) and its mobile chrome. The client portal (`portal-shell.tsx`) already has a mobile-app feel and stays as is. No business logic, data, or page content changes.

## Changes

1. **Treat tablets as mobile for layout**
   - Raise the "mobile shell" breakpoint from `md` (768px) to `lg` (1024px) inside `AppShell`, so phones AND tablets get the app-style chrome and only true laptops/desktops keep the sidebar.

2. **Native-style top app bar (mobile/tablet)**
   - Replace the current thin sidebar strip with a proper sticky top bar: hamburger (opens the existing Sheet drawer), Zest logo + current page title in the middle, and a small avatar/initials button on the right.
   - Add safe-area padding (`env(safe-area-inset-top)`) so it sits correctly on notched phones / installed PWAs.

3. **Bottom tab bar (mobile/tablet)**
   - Add a fixed bottom navigation bar with the 4–5 most-used destinations per role:
     - Admin/Manager/Agent: Dashboard, Clients, Quotations, Invoices, More.
     - "More" opens the existing Sheet drawer with the full nav (including admin section for admins).
   - Active tab uses the brand color; icons + short labels; safe-area padding at the bottom.
   - Add `pb-20` to the main content wrapper so the bottom bar never covers content.

4. **Drawer polish**
   - Make the Sheet drawer full-height with rounded right edge, larger tap targets, and a visible "Sign out" button at the bottom (already present — just restyled for touch).

5. **Page padding / typography on small screens**
   - Add a shared `px-4 py-4` wrapper for mobile and ensure `PageHeader` already wraps; no per-page rewrites needed beyond the shell.

6. **PWA cue**
   - Keep the existing manifest (already standalone). No new service worker. Just ensure the new top/bottom bars use `theme-color` so when installed it looks like an app.

## Out of scope
- Client portal (already mobile-app styled).
- Desktop layout (unchanged at `lg` and above).
- Any data, route, or permission changes.

## Technical notes
- File touched: `src/components/app-shell.tsx` only.
- Reuse existing `Sheet`, `Button`, `Link`, `useRouterState`, and the role-filtered `visibleNav` already computed in the shell.
- Use Tailwind `lg:hidden` / `hidden lg:flex` to gate mobile vs desktop chrome instead of `md:`.
- Bottom bar: `fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border` with `grid grid-cols-5`.
