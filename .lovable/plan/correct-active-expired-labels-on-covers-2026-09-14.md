# Correct active / expired labels on covers

A one-month extendable cover stops being valid the day after the expiry date on the certificate. Today some screens still print the saved word "active" for such a cover, because they show the stored status instead of judging it against the dates.

## What changes

One shared rule decides the label everywhere:

- **Expired** — the expiry date has passed (any cover that was active, renewed or pending).
- **Not started** — the start date is in the future.
- **Cancelled** — unchanged, always wins.
- **Active** — today falls inside the dates.
- Anything else keeps its own wording.

Applied to:

- Policies list badge
- Policy detail header and the Status line
- Client page vehicle cards (both the highlighted cover box and each cover row)
- Client portal: policy list and policy detail

Nothing in the records changes — this is purely what the screens display. When payment completes and a new certificate is issued, that new cover shows as active on its own dates, and the old month reads Expired.

## Technical notes

- Add `coverLabel(policy)` next to the existing `isCoverActive` in `src/lib/policy-balance.ts`, returning a label plus a badge tone.
- Replace raw `p.status` badge rendering in `src/routes/_authenticated/policies.tsx`, `src/routes/_authenticated/policies.$id.tsx`, `src/components/clients/client-vehicles.tsx`, `src/routes/_portal/portal/policies.tsx`, `src/routes/_portal/portal/policies.$id.tsx`.
- Date comparison uses the existing date-only helpers so no timezone drift.
- Filters, queries, balances and automation logic stay exactly as they are.
