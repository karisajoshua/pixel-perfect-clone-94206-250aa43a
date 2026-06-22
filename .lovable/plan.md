Three independent fixes wrapped in one plan.

## 1. Fix "clients.assigned_user_id does not exist" on the portal documents page

`src/lib/kyc.functions.ts` selects a column that doesn't exist on `clients`. The real column is `assigned_agent`. `assigned_user_id` isn't read anywhere downstream, so the fix is to drop it from the SELECT.

- File: `src/lib/kyc.functions.ts` — change the `getMyClient` SELECT list, removing `assigned_user_id`.

## 2. Give clients the same general document upload as the admin side

Today the portal's Documents page only has KYC slots + a read-only "Shared by your agent" list. The admin's `ClientDocuments` component lets staff freely upload arbitrary files to `client-documents/{clientId}/...`. Mirror that for the client.

- Add a new "My uploads" card under the KYC slots on `src/routes/_portal/portal/documents.tsx`.
- Upload to `client-documents/{clientId}/uploads/{timestamp}-{filename}` via signed URL through a new server fn `createMyDocumentUploadUrl` (uses `requireSupabaseAuth`, resolves client by `auth_user_id`, restricts path prefix).
- List, download (signed URL), and delete via existing `listMyDocuments` (already returns `uploads/` folder items) plus a new `deleteMyDocument` server fn that enforces the path prefix.
- Server fns live in `src/lib/portal.functions.ts` (extend the existing file).

Out of scope: changing KYC slot behaviour or admin UI.

## 3. Track branch manager login/logout and time on system

Add lightweight session tracking visible to admins.

Database (migration):
- New table `public.user_sessions` with columns: `user_id uuid`, `started_at timestamptz`, `ended_at timestamptz null`, `last_seen_at timestamptz`, `user_agent text`, plus standard `id`/`created_at`.
- Generated column `duration_seconds` (or computed in views/queries).
- GRANTs: `SELECT, INSERT, UPDATE` to `authenticated`; `ALL` to `service_role`.
- RLS: users can insert/update their own rows; admins (`has_role(auth.uid(),'admin')`) can SELECT all.
- Index on `(user_id, started_at desc)`.

Server functions (`src/lib/sessions.functions.ts`):
- `startMySession()` — inserts a row, returns its id.
- `heartbeatMySession({ id })` — updates `last_seen_at = now()`.
- `endMySession({ id })` — sets `ended_at = now()`.
- `listManagerSessions({ from, to, userId? })` — admin only (verifies `has_role admin`), returns sessions joined with profile name/branch, plus aggregated total seconds per user.

Client wiring (`src/routes/__root.tsx` or a small `useSessionTracker` hook mounted in `_authenticated/route.tsx`):
- On `SIGNED_IN` (or first mount with session): call `startMySession`, stash id in memory + `sessionStorage`.
- Heartbeat every 60s while tab is visible.
- On `SIGNED_OUT`, `beforeunload`, or tab hidden >5 min: call `endMySession`.

Admin UI:
- New route `src/routes/_authenticated/admin.sessions.tsx` (admin-only via `requireRole(["admin"])`):
  - Filters: date range, role = manager (default), specific user.
  - Table: user, branch, started, ended, duration; footer with totals per user for the range.
- Add link to it from the existing admin nav next to "Users & Roles".

Out of scope: granular page-view analytics, idle detection beyond visibility/heartbeat, billing.

## Technical notes

- Duration on display is computed `coalesce(ended_at, last_seen_at) - started_at`; rows without `ended_at` for >15 min are treated as closed at `last_seen_at`.
- Heartbeat-only writes keep RLS simple: row is owned by `auth.uid()`.
- Admin SELECT goes through the security-definer `has_role` to avoid RLS recursion.
