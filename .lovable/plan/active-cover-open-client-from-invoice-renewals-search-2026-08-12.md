# Active cover, open client from invoice, renewals search

## 1. Renewed and new policies count as "active cover"

Today the cover section on a client's vehicle only calls a policy "Active cover" when its status is exactly `active`. In the database there are 23 `pending` and 19 `renewed` policies, of which 25 are currently inside their start/end dates — those show as "Latest cover (not active)" even though the cover is live.

Fix: a cover counts as active when today falls between its start and expiry dates and its status is `active`, `renewed`, or `pending` (cancelled and expired never count). Applied consistently on the client vehicle cards, the policies list badge, and the policy detail header, so a renewed policy or a brand-new client's first cover reads as active straight away.

## 2. "Open client" button on invoices

The invoice detail page gets an **Open client** button next to the existing actions that jumps to that client's detail page. The invoice list rows keep working as they do now.

## 3. Search on Renewals

A search box at the top of the Renewals page filters the buckets live as you type, matching on:
- client name (person or company)
- policy number
- vehicle registration

The urgency buckets (Overdue / 7 / 30 / 31–60 days) stay, showing only matching rows, with a "No renewals match" message when nothing matches.

## Technical notes

- New helper `isCoverActive(policy)` in `src/lib/policy-balance.ts` (or a small `src/lib/policy-status.ts`); used by `src/components/clients/client-vehicles.tsx`, `src/routes/_authenticated/policies.tsx`, `src/routes/_authenticated/policies.$id.tsx`.
- `src/routes/_authenticated/invoices.$id.tsx`: add `<Link to="/clients/$id" params={{ id: inv.clients.id }}>` button (client id is already selected in the query).
- `src/routes/_authenticated/renewals.tsx`: local `search` state, filter `data` before bucketing; query already selects client, insurer and `vehicles(registration_no)`.
- No database or policy changes.
