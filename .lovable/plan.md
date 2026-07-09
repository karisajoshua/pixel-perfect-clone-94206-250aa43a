## Improve "New claim" dialog UX

Edit `src/routes/_authenticated/claims.tsx` — `ClaimDialog` only:

**1. Client → searchable combobox**
- Replace the `Select` (line 244-250) with a Popover + Command (shadcn) searchable picker.
- Shows client display name; filters as admin/manager types. Keeps existing `form.client_id` state.

**2. Policy → auto-prefill + editable**
- When the client changes (or dialog opens with a preselected client), if that client has exactly one active policy, auto-set `form.policy_id` to it.
- If multiple policies exist, auto-pick the most recent one (highest `created_at`) as a sensible default.
- Keep the field as an editable `Select` so the user can change it. Only prefill when `policy_id` is empty or when the selected policy doesn't belong to the new client.
- Extend the `policies` fetch to also load `created_at` (and, if available, `status`) so we can prefer active/most-recent.

**3. Vehicle → auto-prefill**
- Prefer the vehicle linked to the auto-selected policy (fetch `vehicle_id` on `policies`).
- Otherwise, if the client has exactly one vehicle, prefill that.
- Kept editable via the existing `Select`; only prefill when empty or when current vehicle doesn't belong to the client.

**Behavior details**
- Prefill runs on client change and on initial open for `new` claims. When editing an existing claim, don't overwrite values that were already saved.
- No schema changes, no server-function changes.

### Technical notes
- Combobox uses existing `@/components/ui/popover` + `@/components/ui/command` (already in project via shadcn).
- Add `vehicle_id, created_at, status` to the `policies` select; add `created_at` to `vehicles` select for consistent ordering.
- All logic contained inside `ClaimDialog`; no other files touched.