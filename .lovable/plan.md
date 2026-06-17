## Seed underwriters into Insurers

Insert the 14 underwriters into `public.insurers` as active records via the data-insert tool, each with an auto-generated short code. They'll immediately appear in **Admin > Insurers** (for admins) and in the **Insurer** dropdown of the Policy, Quotation, and Invoice forms for all roles (agent/manager/admin) — no code changes needed since those screens already query the `insurers` table filtered by `active = true`.

### Records to insert

| Name | Short code |
|---|---|
| ICEA Lion | ICEA |
| The Heritage | HER |
| Old Mutual | OM |
| Kenindia Assurance | KEN |
| APA | APA |
| CIC | CIC |
| Britam | BRIT |
| Pioneer | PIO |
| Definite Assurance | DEF |
| Directline Assurance | DIR |
| The Monarch | MON |
| Kenyan Alliance | KAL |
| AMACO | AMA |
| Pacis | PAC |

All set `active = true`. `contact_email` / `contact_phone` left null — admins can fill them in later via Admin > Insurers.

Insert is idempotent via `ON CONFLICT (name) DO NOTHING` so re-running is safe.

### Technical notes
- Single `INSERT` against `public.insurers` through the data-change tool (not a migration — no schema change).
- No frontend changes: `src/routes/_authenticated/admin.insurers.tsx` already lists them; `src/components/policies/policy-form-dialog.tsx` and the quotation/invoice forms already populate their Insurer `<Select>` from this table.
