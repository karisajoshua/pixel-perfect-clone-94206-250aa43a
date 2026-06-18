## Problems

1. **Client portal Documents page is read-only.** It lists files but has no upload UI, and storage RLS has no INSERT/UPDATE policy for clients on `client-documents` — so clients literally cannot upload their KYC docs. This is what the user means by "the document upload for kyc doesn't work".
2. **No onboarding nudge.** When a client signs in with `kyc_status != 'verified'`, nothing tells them to complete KYC.
3. **Same issue for staff roles.** Admin/agent/manager dashboards don't surface their pending setup tasks (no branches, no insurers, missing profile fields, etc.).

(Note on "side menus" — the portal correctly uses its own `PortalShell` with a slim client sidebar, not the admin shell. I'll leave that nav in place; if you actually want the sidebar hidden for clients, say so and I'll remove it.)

## Plan

### 1. Let clients upload their own KYC docs
- Add a storage migration: INSERT + UPDATE + DELETE policies on `storage.objects` for `bucket_id='client-documents'` scoped to `(storage.foldername(name))[1] = current_client_id()::text`. Clients can only touch their own folder.
- Extend `/portal/documents` page with an Upload button (file input + drag-drop), uploading to `{client_id}/{timestamp}-{name}`, with toast feedback and query invalidation. Reuse the pattern from `ClientDocuments` but call it through the portal's authenticated path.
- Add a `Delete` action limited to files the client uploaded themselves (we'll prefix client-uploaded files with `kyc/` so staff-shared files are not removable by the client).

### 2. KYC banner + onboarding card on portal sign-in
- New component `KycBanner` shown at the top of every `/portal/*` page when `client.kyc_status` is `pending` or `incomplete`. It includes:
  - A clear "Complete your KYC" message
  - List of what's needed (ID copy, KRA PIN, proof of address)
  - Primary CTA → `/portal/documents` (scroll-to upload)
  - Secondary CTA → `/portal/profile` to fill missing ID number / KRA PIN / DOB
- `getPortalOverview` already returns `client`; add `kyc_status` + missing-field flags to its return so the banner has data without an extra round-trip.
- Also surface an inline toast (sonner) once per session via a tiny `useEffect` in `PortalShell` when `kyc_status !== 'verified'`.

### 3. Onboarding guidance for staff roles
- New `OnboardingChecklist` card on `/dashboard` (admin/manager/agent view) that pulls from a new lightweight server fn `getOnboardingStatus`:
  - Admin: branches exist? insurers exist? at least one other staff invited? email domain verified?
  - Manager/agent: profile has phone + branch assigned? at least one client created?
- Each item is a row with status badge + "Do it" link to the relevant admin or workspace page.
- A dismissible top-of-dashboard alert appears when any required item is incomplete, mirroring the portal KYC banner pattern for visual consistency.

### 4. Wire-up
- Surface counts in the existing `PageHeader` help panel (already in place) so the same guidance is reachable from any page, not only the dashboard.

## Technical notes

- New migration: 3 storage policies (`INSERT`, `UPDATE`, `DELETE`) on `client-documents` scoped to the client's own folder via `current_client_id()`.
- New server fn: `getOnboardingStatus` in `src/lib/portal.functions.ts` (or a new `src/lib/onboarding.functions.ts`) with `requireSupabaseAuth`. Returns `{ role, items: [{ id, label, done, href }] }`.
- `getPortalOverview` return shape gains `kyc: { status, missingFields: string[] }`.
- New components:
  - `src/components/portal/kyc-banner.tsx`
  - `src/components/portal/document-upload.tsx`
  - `src/components/onboarding-checklist.tsx`
- Edits:
  - `src/routes/_authenticated/portal/documents.tsx` — add upload UI
  - `src/components/portal/portal-shell.tsx` — render `KycBanner` above `{children}` when status pending
  - `src/routes/_authenticated/dashboard.tsx` — render `OnboardingChecklist`
  - `src/lib/portal.functions.ts` — extend overview, add onboarding fn

No changes to existing layouts, route structure, or auth flow.
