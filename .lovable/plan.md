# Re-use the client's KYC logbook for vehicle scan

Today the "Scan log book" button in the vehicle dialog always opens a file picker. You want it to use the logbook the admin already uploaded under the client's KYC, so no second upload is needed (especially on Edit).

## How it will work

When the vehicle dialog opens with a client selected (both New and Edit):

1. The dialog asks the server whether that client has a usable logbook on file. We accept any of these KYC doc types, in this priority order: `log_book`, then `importation_doc`, then `search_doc`.
2. If one exists, the Scan button becomes **"Scan client's log book"** and shows the file name underneath (e.g. "Using: KDA123A-logbook.pdf"). Clicking it runs the scanner against that stored file — no upload, no file picker.
3. If none exists, the button stays as today: **"Scan log book"** opens the file picker. We'll add a small hint: "No log book on file for this client. Upload one under Clients → KYC to reuse it next time."
4. After a successful scan, fields auto-fill the same way they do now (with the "auto" badges, only filling empty fields, user reviews before saving).

This works for both creating a new vehicle (once a client is picked) and editing an existing vehicle (client is already known).

## Technical details

- **`src/lib/vehicles.functions.ts`** — two changes:
  - New server fn `getClientLogbookDoc({ client_id })` (protected, staff-only): looks up the most recent `client_required_documents` row for that client where `doc_type IN ('log_book','importation_doc','search_doc')` and `storage_path IS NOT NULL`, returns `{ storage_path, file_name, doc_type } | null`. Uses `supabaseAdmin` inside the handler.
  - Extend `extractLogbookFields` input: accept either the existing `{ file_data_url, mime_type, filename }` OR a new `{ client_id, storage_path }` variant. In the storage variant the handler verifies the path begins with `${client_id}/kyc/`, downloads the file via `supabaseAdmin.storage.from("client-documents").download(path)`, infers mime from extension, converts to a data URL, then runs the same AI prompt path. No change to the returned shape.

- **`src/components/vehicles/vehicle-form-dialog.tsx`**:
  - When `form.client_id` changes, call `getClientLogbookDoc` and store `storedLogbook` in state.
  - If `storedLogbook` exists: render the Scan button as "Scan client's log book" with the file name beneath; clicking calls `extractFn({ data: { client_id, storage_path } })` directly — no file input. Keep a small "Upload different file" link that falls back to the existing picker flow.
  - If not: keep today's button + add the hint text.
  - All other logic (auto-fill, badges, toasts) unchanged.

No DB migration, no new bucket, no policy change. Staff-only — the portal vehicle pages are not touched.

## Files

- edit `src/lib/vehicles.functions.ts`
- edit `src/components/vehicles/vehicle-form-dialog.tsx`
