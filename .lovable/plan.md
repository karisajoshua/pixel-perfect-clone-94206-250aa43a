## Goal
Let clients edit and save their own profile details from `/portal/profile`.

## Editable fields
Safe self-service fields (identity/financial fields stay read-only and managed by agents):
- Phone, Alternate phone
- Postal/Physical address, City
- Date of birth (individual clients)
- KRA PIN, ID number — editable only while KYC is not yet `verified`

Read-only on the portal: full name, company name, client type, email, branch, assigned agent, KYC status.

## Backend
Add `updateMyProfile` server function in `src/lib/portal.functions.ts`:
- `requireSupabaseAuth` middleware
- Zod-validate the editable fields (length limits, phone format via existing `src/lib/phone.ts`, ISO date)
- Resolve client via `getMyClient(supabase, userId)` (RLS already scopes by `auth_user_id`)
- `UPDATE public.clients SET ... WHERE id = client.id` — never accept `id`, `auth_user_id`, `branch_id`, `assigned_agent`, `kyc_status`, `client_type`, `full_name`, `company_name`, `email` from the client
- If KYC is `verified`, strip `id_number` and `kra_pin` from the update payload server-side
- Return the refreshed client row

No schema/RLS migration needed — existing `clients` policy already permits the client to update their own row via `auth_user_id = auth.uid()` (verify during build; add a narrow policy only if missing).

## Frontend
Rewrite `src/routes/_portal/portal/profile.tsx`:
- Replace the static `<Row>` grid with a `react-hook-form` + `zod` form using existing `Form`, `Input`, `Label` components
- Group: Contact info, Address, Identification (locked once KYC verified, with a hint)
- "Save changes" button using `useMutation` → `updateMyProfile`, toast on success, invalidate `portal-overview`
- "Cancel" resets the form to server values
- Keep the existing "contact your agent to change locked fields" note for read-only fields

## Out of scope
- Editing email (auth-managed; would need re-verification flow)
- Avatar upload
- Any admin-side changes
