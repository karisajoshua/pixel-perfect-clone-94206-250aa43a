## What's going wrong

The portal page uploads files directly from the browser to the `client-documents` storage bucket. Storage allows that upload only when the first folder in the path equals the signed-in user's linked client id (the SQL policy `(storage.foldername(name))[1] = current_client_id()::text`). When that lookup returns nothing, every upload fails with **"new row violates row-level security policy"** — exactly what you're seeing.

I checked the database: out of **1007 clients, 0 have a portal login linked** (`auth_user_id` is empty on every row). So `current_client_id()` returns nothing for any client account that signs in today, and storage rejects the upload before the file ever lands.

This usually happens after a fresh client import (the new rows come in without `auth_user_id`), or because the portal accounts were created against earlier client rows that were later re-imported.

## Plan

### 1. Make uploads work through the server, not direct-from-browser

Replace the browser → storage upload in the portal KYC page with a server-issued **signed upload URL**. The server function authenticates the user, looks up their client, builds the path itself, and hands back a one-shot upload URL. Storage RLS no longer has to evaluate against `current_client_id()` for the upload step — it only matters for read/delete, which already work for staff anyway.

- New server function `createKycUploadUrl({ doc_type, file_name })` in `src/lib/kyc.functions.ts`:
  - protected by `requireSupabaseAuth`
  - calls `getMyClient` (the same helper the page already uses)
  - builds `path = ${client.id}/kyc/${doc_type}/${Date.now()}-${safe}`
  - calls `supabase.storage.from('client-documents').createSignedUploadUrl(path)` and returns `{ path, token }`
- Update `src/routes/_portal/portal/documents.tsx` `DocSlot.onFile`:
  - call `createKycUploadUrl`, then `supabase.storage.from('client-documents').uploadToSignedUrl(path, token, file, { contentType })`
  - then call the existing `recordKycUpload` exactly as today
- Same treatment for `src/components/clients/client-kyc-panel.tsx` (admin "upload on behalf of client") — add a sibling `staffCreateKycUploadUrl` so admins don't depend on storage RLS either.

### 2. Surface a clearer message when an account isn't linked to a client

`getMyRequiredDocuments` already throws "Your account isn't linked to a client record yet". The page renders that in a red box. Keep that behaviour, but also:

- In the portal route guard (`src/routes/_portal/route.tsx`), if the signed-in user has the `client` role but **no** matching `clients.auth_user_id` row, redirect to a small explainer page (or show an inline message in `portal/index.tsx`) instead of letting them land on a broken Documents tab.

### 3. One-time data check (no migration)

Not part of the code change, but worth flagging in the same turn so you can decide:
- 0 of 1007 clients have a portal login attached. Any client who needs portal access has to be re-issued one from **Admin → Clients → Generate portal login** (which already correctly sets `auth_user_id` + the `client` role). I'll mention this in the final reply, not silently re-run it.

## Files touched

- `src/lib/kyc.functions.ts` — add `createKycUploadUrl` and `staffCreateKycUploadUrl`
- `src/routes/_portal/portal/documents.tsx` — switch `onFile` to signed-URL flow
- `src/components/clients/client-kyc-panel.tsx` — switch `uploadFor` to signed-URL flow
- `src/routes/_portal/route.tsx` — friendlier handling for unlinked client accounts

No database migration, no new storage bucket, no policy change.
