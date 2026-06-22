## Vehicle edit: lock client + logbook auto-fill

Two changes to the vehicle form (`src/components/vehicles/vehicle-form-dialog.tsx`).

### 1. Client field on edit — no dropdown, just the name

When editing an existing vehicle (or when `defaultClientId` is passed in from a client page), replace the Client `<Select>` with a read-only display showing the client's name. The dropdown stays only for the "New vehicle" case opened from the global Vehicles list with no pre-selected client.

- Fetch the single client by `initial.client_id` (or `defaultClientId`) and render its name in a disabled input / muted text row labelled "Client".
- The client cannot be reassigned from this dialog — matches the rest of the app where vehicles belong to one client.

### 2. "Scan logbook" to auto-fill vehicle fields

Add a **Scan logbook** button at the top of the dialog. Flow:

1. User picks a logbook image or PDF (camera or file).
2. File is uploaded to the existing `client-documents` storage bucket under `logbooks/{client_id}/{vehicle_id|temp}-{timestamp}` so it's retained as a KYC-style record.
3. A new server function `extractLogbookFields` (in `src/lib/vehicles.functions.ts`, protected with `requireSupabaseAuth`) sends the file to the Lovable AI Gateway (`google/gemini-2.5-flash`, multimodal `image_url` / `file` block) with a prompt that asks for a strict JSON object with keys: `registration_no`, `make`, `model`, `year`, `body_type`, `color`, `chassis_no`, `engine_no`, `fuel_type`, `seating_capacity`, `cubic_capacity`, `usage_type`. Unknown fields → `null`.
4. The dialog merges the returned fields into form state **only for fields the user hasn't already filled** (no overwrite of edited values), shows a toast "Logbook scanned — review highlighted fields", and visually marks auto-filled inputs (subtle ring + small "auto" badge) so staff knows what to verify.
5. Errors (unreadable image, no JSON, gateway failure) surface as a toast; nothing is filled.

### Out of scope

- Changing how vehicles are created from the global Vehicles list with no client context (dropdown stays there).
- Storing the parsed logbook payload as structured KYC — just the file is stored; extracted values land directly in the vehicle form.
- OCR for any document other than the Kenyan NTSA logbook.

### Files touched

- `src/components/vehicles/vehicle-form-dialog.tsx` — replace client Select with read-only display when `initial?.client_id` or `defaultClientId` is set; add Scan logbook button, file input, upload + extract handler, auto-fill merge, highlight ring on auto-filled fields.
- `src/lib/vehicles.functions.ts` (new) — `extractLogbookFields` server fn: takes `{ storage_path }`, downloads via signed URL, calls Lovable AI Gateway with the logbook image, returns parsed JSON.
- No DB migration. No new bucket.
