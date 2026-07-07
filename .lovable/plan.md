## Fix IPEN Register payload — wrap in `registerUserDto` and add missing required fields

The new error tells us two things:

1. The endpoint expects the body **wrapped** in a `registerUserDto` object (not fields at the top level).
2. That DTO requires additional fields we're not sending: **`registerAs`**, **`idNumber`**, **`identificationTypeId`** (in addition to the name/email/password/phone we already send).

### Changes

**1. `src/lib/ipen/auth.functions.ts`**

- Extend the Zod input schema with the new required fields:
  - `registerAs` (string — likely `"Individual"` or `"Corporate"`; default `"Individual"`)
  - `idNumber` (string, required — currently optional)
  - `identificationTypeId` (number or string — e.g. `1` for National ID)
- Build the inner DTO with both camelCase and PascalCase keys (keep the existing `dual()` helper).
- Wrap the DTO under a top-level `registerUserDto` / `RegisterUserDto` key before POSTing to `/api/Auth/Register`.

**2. `src/components/... admin.ipen.tsx` registration form**

- Add three new inputs to the "Create IPEN account" form:
  - **Register as** — select: Individual / Corporate
  - **ID number** — text input (required)
  - **ID type** — select (National ID, Passport, Alien ID) mapped to the numeric `identificationTypeId` the API expects
- Pass the new values into the `registerIpen` server-fn call.

### Open question

I'm guessing the valid values for `registerAs` (`"Individual"` / `"Corporate"`) and `identificationTypeId` (`1` = National ID, `2` = Passport, `3` = Alien) from typical Kenyan insurance schemas. If Africa Bima's docs give exact enum values/IDs, share them and I'll wire the correct constants. Otherwise I'll ship the sensible defaults above and we can adjust once the next error (if any) tells us the accepted set.

### Files touched

- Edit: `src/lib/ipen/auth.functions.ts` — schema + wrap body in `registerUserDto`.
- Edit: `src/routes/_authenticated/admin.ipen.tsx` — add the three new form fields.
