# Fix duplicate and mixed-case insurer names

## What's happening
The insurer list isn't repeating the same record twice — it holds near-duplicate entries created at different times, plus inconsistent capitalisation:

- Definite / DEFINITE ASSURANCE
- ICEA (trailing space) / ICEA LION
- Monarch / THE MONARCH
- TRIDENT / Triedent (both unused)
- Mixed case: Old Mutual, Saham Assurance, OIC

So each of those insurers looks like it appears twice in the Insurer dropdown when editing a policy.

## The fix

1. Merge each duplicate pair into one record, keeping the entry with the logo and the most history, and re-pointing the other one's policies and quotations to the survivor before deleting it:
   - Definite (3 policies, 1 quote) -> DEFINITE ASSURANCE
   - ICEA LION (1 policy) -> ICEA (renamed to ICEA LION, trailing space trimmed)
   - Monarch (15 policies) -> THE MONARCH
   - Triedent + TRIDENT (both unused) -> delete
2. Uppercase and trim every remaining insurer name, so the list reads AMACO, APA, BRITAM, CIC, DEFINITE ASSURANCE, DIRECTLINE ASSURANCE, ICEA LION, KENINDIA, KENYA ALLIANCE, OIC, OLD MUTUAL, PACIS, PIONEER, SAHAM ASSURANCE, THE HERITAGE, THE MONARCH.
3. Add a case-insensitive uniqueness rule on insurer names so the same company can't be added twice again.
4. In the app, display insurer names in uppercase and de-duplicate the dropdown list by id, in the policy form, quotations, and the admin Insurers page.

## Technical notes
- One migration: UPDATE policies/quotations/tenant_insurers to the surviving insurer id, delete the merged rows, `UPDATE insurers SET name = upper(btrim(name))`, then a unique index on `upper(btrim(name))`.
- `tenant_insurers` links are re-pointed with conflict handling so a tenant keeps a single enabled link per insurer.
- UI: `src/components/policies/policy-form-dialog.tsx` (dedupe by id + uppercase render), plus the insurer selects in `src/routes/_authenticated/quotations.tsx` and `src/routes/_authenticated/admin.insurers.tsx`.
