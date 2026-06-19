## Goal

Fix client-portal document uploads and replace the free-form upload with a **structured required-documents checklist** so clients submit exactly the KYC files we need before they can be verified.

## Why uploads are likely failing

The `client-documents` bucket has an INSERT policy that requires `storage.foldername(name)[1] = current_client_id()`. The portal uploads to `${clientId}/kyc/...` which matches — so the policy itself is correct. The most common reason a logged-in portal user still gets denied is that their `auth.users` row is not linked to a `clients` row (so `current_client_id()` returns `null` and the policy rejects the path). The current page also silently fails when `clientId` is missing because the button is disabled but no message is shown.

We will:
1. Surface the real error to the user when the upload is blocked.
2. Add a guard + clear message when the account isn't linked to a client record (so the user knows to contact their agent).
3. Add a one-time backfill step in `handle_new_user` style: if a client signs in whose email matches a `clients` row with no `auth_user_id`, link them. (Already in the trigger — we'll add a manual "link my account" server fn for clients whose email differs.)

## Required documents — structured checklist

Today `documents.tsx` is a generic file list. We replace it with a checklist of the documents the PRD requires for KYC, each with its own upload slot, status, and (optional) expiry:

Required slots (individual clients):
- National ID — front
- National ID — back
- KRA PIN certificate
- Proof of address (utility bill / bank statement, < 3 months)
- Passport photo

Required slots (corporate clients) — shown instead of ID front/back:
- Certificate of incorporation
- CR12 / company registry extract
- KRA PIN certificate (company)
- Director's ID
- Proof of address

Each slot shows: required/optional badge, current file (if any) with preview/download, replace + remove actions, and verification status (pending / verified / rejected with reason).

A header progress bar shows "4 of 5 documents uploaded — submit for review". The "Submit for review" button is enabled only when every required slot has a file; it flips the client's `kyc_status` from `pending` to `in_review` and notifies the assigned agent.

## Data model

New table `client_required_documents` (one row per uploaded slot):

- `client_id` (fk → clients)
- `doc_type` enum: `id_front | id_back | kra_pin | proof_of_address | passport_photo | cert_incorporation | cr12 | director_id`
- `storage_path` text (path in `client-documents` bucket)
- `status` enum: `pending | verified | rejected`
- `rejection_reason` text
- `verified_by`, `verified_at`
- `expires_at` date (optional, for proof-of-address freshness)
- unique (`client_id`, `doc_type`)

Standard timestamps + update trigger. GRANTs to `authenticated` and `service_role`. RLS:
- Client: select/insert/update/delete their own rows (`client_id = current_client_id()`)
- Staff (admin/manager/agent): select all; update status to verify/reject
- Files continue to live in the existing `client-documents` bucket under `${clientId}/kyc/${doc_type}/${filename}`; existing storage policies already cover read/write.

A helper view or server fn returns the checklist (merging the static required list with the client's uploaded rows) so the UI gets one tidy payload.

## UI changes

- `src/routes/_portal/portal/documents.tsx` — rewrite as the structured checklist described above. Keep the "Shared by agent" list as a separate section below.
- `src/components/portal/kyc-banner.tsx` — point its "Complete KYC" CTA to the new checklist and read the new completion state.
- `src/routes/_authenticated/clients.$id.tsx` (staff view) — add a "KYC documents" panel showing each slot with verify / reject actions and rejection reason input.
- Toast the real Supabase error string on upload failure instead of silently disabling the button.

## Server functions (in `src/lib/portal.functions.ts` and a new `src/lib/kyc.functions.ts`)

- `getMyRequiredDocuments` — returns the merged checklist for the signed-in client.
- `uploadRequiredDocument({ doc_type, path })` — records the row after the browser uploads the file directly to storage.
- `removeRequiredDocument({ doc_type })` — deletes file + row.
- `submitKycForReview` — guard: all required slots filled; sets `clients.kyc_status = 'in_review'`; queues a notification to the assigned agent.
- Staff: `verifyClientDocument({ id })`, `rejectClientDocument({ id, reason })`, `setClientKycStatus({ client_id, status })`.

## Out of scope

- No changes to staff-side `clients/$id` document uploads other than the new KYC panel.
- No SMS/WhatsApp work — covered by the earlier plan.

## Open question

Are your clients mostly **individuals**, mostly **corporates**, or a mix? This determines whether we show one slot set, both, or switch based on `clients.client_type` (default plan assumes we switch based on `client_type`).
