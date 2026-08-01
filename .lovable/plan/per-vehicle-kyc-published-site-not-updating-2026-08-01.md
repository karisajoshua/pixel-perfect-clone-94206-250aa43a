# Per-vehicle KYC + published site not updating

## Part 1 — Vehicle documents move to each vehicle

Today every document (including log book / importation / search) is attached to the client, and the storage table allows only one row per document type per client. So a client with three vehicles can only ever hold one log book.

Change: vehicle documents become per-vehicle, while personal/company KYC (ID, KRA PIN, CR12, etc.) stays at client level.

**Data change**
- Add an optional `vehicle_id` link on the client documents table (references vehicles, removed with the vehicle).
- Replace the "one row per client + document type" rule with two rules: one per client for client-level documents, one per vehicle for vehicle documents.
- Existing log book / importation / search rows stay as-is (unlinked) and can be re-uploaded against a vehicle.

**Client page — Vehicles tab**
- Each vehicle card gets a "Documents" section with three slots: Log book, Importation document, Search document.
- Per slot: upload / replace, view, verify, reject with reason — same controls as the current KYC panel.
- A per-vehicle status badge: Verified (at least one document verified), Awaiting review, Missing documents.
- The vehicle header shows a documents badge so gaps are visible without expanding.

**Client page — KYC tab**
- Vehicle slots are removed from the general KYC panel; it covers only personal/company documents.
- A short note points to the Vehicles tab for vehicle paperwork.

**Client portal**
- The client's own documents page lists vehicle document slots grouped per vehicle (registration number as heading) instead of one shared set.

**Log book auto-extract**
- The existing "read the log book" extraction keeps working, now reading the document attached to that specific vehicle.

## Part 2 — Published site still shows old build

Changes work in preview but not after publishing. Steps:
1. Publish again and confirm the deploy completes.
2. Fetch the live site (both the Lovable URL and app.zestinsurance.co.ke) and compare the served build assets against the current build to prove whether the deploy actually shipped or a cache/domain layer is serving a stale copy.
3. If the Lovable URL is current and the custom domain is stale, the issue is the domain's CDN cache — resolve there. If both are stale, investigate the build/deploy output.

Note: a signed-in browser can also hold an old cached bundle; a hard refresh is worth ruling out first.

## Technical notes

- Migration: `ALTER TABLE public.client_required_documents ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;` drop `client_required_documents_client_id_doc_type_key`, add two partial unique indexes (`vehicle_id IS NULL` / `vehicle_id IS NOT NULL`), plus an index on `vehicle_id`. No RLS change needed — rows stay client-scoped.
- `src/lib/kyc.functions.ts`: drop `VEHICLE_SLOTS` from the client-level slot list; add `vehicle_id` to the staff upload / signed-URL / verify / reject functions and a `listVehicleKycDocuments` fetcher; storage path becomes `<client>/kyc/vehicles/<vehicle>/...`.
- `src/lib/portal.functions.ts`: return vehicle document slots grouped per vehicle.
- New `src/components/clients/vehicle-documents.tsx` reusing the upload/verify/reject UI from `client-kyc-panel.tsx`; rendered inside each card in `src/components/clients/client-vehicles.tsx`.
- `src/lib/vehicles.functions.ts`: `getClientLogbookDoc` filters by `vehicle_id`.
