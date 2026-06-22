## Goals
1. Let admins/managers upload KYC documents on behalf of a client from the staff KYC panel.
2. Add three new optional vehicle-related slots: Log book, Importation document, Search document — client picks any (accept jpeg/jpg/png/pdf/doc/docx).
3. When a client record is created in the system, auto-provision a portal login so they don't have to self-register.

## Plan

### 1. Expand KYC document types
- Migration: add `log_book`, `importation_doc`, `search_doc` values to the `public.kyc_doc_type` enum.
- In `src/lib/kyc.functions.ts`:
  - Extend the `KycDocType` union and the `z.enum([...])` validators in `recordKycUpload` / `removeKycUpload` with the three new types.
  - Add a new `VEHICLE_SLOTS` array (all optional) and append it to both `INDIVIDUAL_SLOTS` and `CORPORATE_SLOTS` so every client sees them.
  - Accept the wider MIME list (jpeg, png, pdf, doc, docx) — current code doesn't filter, but make the file input `accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"` everywhere it's used.

### 2. Staff-side KYC uploads
- New server fn in `kyc.functions.ts`: `staffUploadKycDocument` (admin/manager/agent only) — accepts `{ client_id, doc_type, storage_path, file_name }`, validates path prefix `${client_id}/kyc/`, upserts into `client_required_documents` exactly like `recordKycUpload`, marks status `verified` (since staff uploaded it themselves) with `verified_by = userId`.
- Update `src/components/clients/client-kyc-panel.tsx`:
  - For each slot, add a hidden file input + "Upload" button when `!item.row` (or "Replace" when row exists).
  - On change: upload file to `client-documents` bucket at `${clientId}/kyc/${doc_type}-${timestamp}.${ext}`, then call `staffUploadKycDocument`.
  - Show new Vehicle docs section (Log book / Importation doc / Search doc) below the existing slots.

### 3. Client-side uploads for new types
- The existing portal KYC page already iterates over `getMyRequiredDocuments` items, so once the slots are appended in step 1 they show automatically. Just confirm the upload `accept` attribute on the portal includes the wider format list.

### 4. Auto-create portal login when a client is added
- New server fn `createClientPortalAccount` in `src/lib/admin-users.functions.ts` (admin/manager only):
  - Uses `supabaseAdmin.auth.admin.createUser({ email, password: <random>, email_confirm: true, user_metadata: { full_name } })`.
  - Links the new auth user to the existing client row (`clients.auth_user_id`).
  - Assigns `client` role in `user_roles`.
  - Returns `{ email, password }` for one-time display.
- Wire into `ClientFormDialog` (after a successful create, if `email` is present): call the fn, then show a dialog/toast with the generated credentials and a "Copy" button. Also expose a "Generate portal login" button on the client detail page for existing clients without `auth_user_id`.
- Keep the existing email-match trigger (`handle_new_user`) intact — it still works if the client later self-signs-up.

## Technical notes
- The `handle_new_user` trigger inserts a profile row and (for matched clients) a `client` role; calling `supabaseAdmin.auth.admin.createUser` fires it, so we only need to upsert the role if missing and ensure `clients.auth_user_id` is linked (trigger already does it when emails match).
- Generated password: 16 random chars (`crypto.randomBytes(12).toString('base64url')`).
- File-size/type validation stays client-side for now (existing pattern).
- No schema change needed for the credentials feature — Supabase Auth handles it.

## Files touched
- `supabase/migrations/<new>.sql` (enum values)
- `src/lib/kyc.functions.ts`
- `src/lib/admin-users.functions.ts`
- `src/components/clients/client-kyc-panel.tsx`
- `src/components/clients/client-form-dialog.tsx` (post-create credential reveal)
- `src/routes/_authenticated/clients.$id.tsx` (button for existing clients)
