## Fixes

### 1. Auto-verify KYC when all required docs are uploaded
In `src/lib/kyc.functions.ts`, add a helper `maybeAutoVerifyClientKyc(client_id)` that:
- Loads the client's `client_type` and current `kyc_status`.
- Computes required slots (INDIVIDUAL_SLOTS or CORPORATE_SLOTS where `required: true`).
- Counts existing `client_required_documents` rows for those required types.
- If all required types are present AND `kyc_status !== 'verified'`, update `clients.kyc_status = 'verified'`.

Call this helper at the end of:
- `recordKycUpload` (client self-upload)
- `staffUploadKycDocument` (staff upload — these are already saved as `verified`)
- `verifyKycDocument` (staff verifies an existing doc)

Use `supabaseAdmin` for the update so it works regardless of who triggered it.

### 2. "Edit client → Save" error
Investigate in build mode. Likely cause in `src/components/clients/client-form-dialog.tsx`: the update payload spreads `form` (which contains joined fields like `branches`, `created_at`, etc. when `initial` came from a SELECT with relations) and also re-sets `created_by`, which conflicts with the `enforce_creator_branch` trigger / non-updatable columns. Fix by:
- Building a clean whitelist of writable columns for updates (full_name, company_name, client_type, id_number, kra_pin, email, phone, alt_phone, city, address, notes, branch_id only when admin).
- Not sending `created_by` on update.
- Logging the actual server error to confirm before shipping.

### 3. Receipt PDF — header overlap
In `src/lib/receipt-pdf.ts` header section:
- Move agency text block to wrap within a max width so it never crosses into the right-side "OFFICIAL RECEIPT" column. Compute `leftW = contentW * 0.55` and `splitTextToSize` for address/contact lines.
- Right column meta: align labels and values inside a fixed width (e.g. `rx - 160` to `rx`) and place "OFFICIAL RECEIPT" title slightly higher so the label/value rows sit below it cleanly.

### 4. Receipt PDF — stamp above signatory
Restructure the "AUTHORIZED BY" card so the stamp sits centered above the signature line:
- Top of card: `AUTHORIZED BY` label.
- Middle: stamp image centered (`~70×70 pt`).
- Below stamp: signature line, then `Elizabeth Grace` and `Authorized Signatory`.
- Increase the card height to accommodate; keep the right-side summary table at the same `startY` so the two columns visually align.

## Verification
- Upload all required KYC docs as a client and as staff → client KYC flips to Verified automatically.
- Edit an existing client, change phone/address, click Save → no error, value persists.
- Generate a receipt PDF → no text overlap in header; stamp renders above signatory line.