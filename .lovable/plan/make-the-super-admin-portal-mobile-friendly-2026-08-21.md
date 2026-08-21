# Make the Super Admin portal mobile friendly

The platform (super admin) area was built desktop-only: a fixed 260px sidebar always takes space, pages use large padding, filter controls have fixed pixel widths, and the wide tables overflow the screen. On a phone this squeezes content into a narrow strip and clips columns.

## What changes

### 1. Layout and navigation
- On phones/tablets, hide the fixed sidebar and show a top bar with the "Super Admin" title and a menu button that opens the same navigation in a slide-out drawer (same pattern as the agency workspace).
- Tapping any nav item closes the drawer.
- Keep the permanent sidebar on large screens exactly as it is today.
- Sign out and "My agency workspace" stay reachable at the bottom of the drawer.

### 2. Page padding and headings
- Reduce page padding on small screens (tight on mobile, current spacing from `sm:` upward) on Overview, Agencies, Agency detail, Notices and Audit log.
- Headings shrink one step on mobile; header rows with an action button stack instead of colliding.

### 3. Filters and toolbars
- Agencies page: search field goes full width on mobile; Status / Plan / Sort selects become a responsive grid (two per row on mobile, inline row on desktop). The "Showing X of Y" counter moves below on mobile.
- Audit log: Agency and Action filters go full width on mobile, side by side from `sm:` up.

### 4. Tables
- Wrap every wide table (Overview agencies, Agencies list, Agency detail sections, Notices, Audit log) in a horizontally scrollable container so no column is clipped and the page itself never scrolls sideways.
- On the Agencies list, hide the lower-priority columns (Plan, Onboarded) on small screens; the same information already appears on the agency detail page.
- Long text cells truncate rather than pushing the layout wide.

### 5. Dialogs
- The broadcast/send-notice dialog gets a mobile-safe width and scrolls internally when it exceeds screen height.

## Technical notes
- `src/routes/_platform/route.tsx`: add `useState` drawer with the existing `Sheet` component, `hidden lg:flex` on the aside, mobile header bar with `Menu` icon; nav items extracted to a shared array so the sidebar and drawer render from the same source.
- Table wrappers: `<div className="overflow-x-auto">` (the shadcn `Table` already has a wrapper on some versions — verify and avoid double scrollbars).
- Responsive column hiding via `hidden md:table-cell` on both the `TableHead` and matching `TableCell`.
- Fixed widths (`w-72`, `w-40`, `w-48`, `w-64`) replaced with `w-full sm:w-…` or grid columns.
- No changes to data fetching, server functions, or permissions — presentation only.
