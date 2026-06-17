## Goal

Send branded emails from `notify.zestinsurance.co.ke` for every customer-facing event in the app, plus brand all auth emails. All sends fire automatically when the event occurs (idempotent — safe on retries).

## Already in place

- Verified domain `notify.zestinsurance.co.ke`
- Email infrastructure (queue, cron, suppression, unsubscribe)
- Existing templates: `renewal-reminder`, `policy-issued`, `payment-receipt`, `claim-update`

## New app email templates

Created under `src/lib/email-templates/` and registered in `registry.ts`:

1. **client-welcome** — new client added with an email
2. **quotation-sent** — quotation issued/sent to client (with totals + validity)
3. **invoice-issued** — new invoice created (amount, due date, link)
4. **claim-acknowledgement** — claim filed (claim no, next steps)
5. **portal-invite** — when a client is granted portal access

All match the existing brand styling (Zest red logo, Inter, white body, card layout used in `payment-receipt`/`claim-update`).

## Auto-fire wiring (one helper, one call per event)

Add `src/lib/email/send.ts` (client + server helper) that POSTs to `/lovable/email/transactional/send` with the user's JWT and an `idempotencyKey` derived from the entity id + template name.

Fire from existing creation/update sites:

| Event | File | Template |
|---|---|---|
| Client created (with email) | `client-form-dialog.tsx`, `admin.import.tsx` | `client-welcome` |
| Quotation issued | `quotations.tsx` | `quotation-sent` |
| Policy issued | `policy-form-dialog.tsx` | `policy-issued` (already exists) |
| Invoice created | `invoice-form-dialog.tsx` | `invoice-issued` |
| Payment recorded | payment recording flow | `payment-receipt` (already exists) |
| Claim created | `claims.tsx` | `claim-acknowledgement` |
| Claim status changed | `claims.tsx` | `claim-update` (already exists) |
| Renewal window hit | existing cron `renewal-reminders` | `renewal-reminder` (already exists) |

Idempotency keys (e.g. `client-welcome-{clientId}`, `invoice-issued-{invoiceId}`) ensure re-saves and importer re-runs don't double-send. Importer bulk-creates skip welcome emails by default to avoid mass-mailing legacy clients.

## Auth emails

Run `scaffold_auth_email_templates` to brand: signup confirm, magic link, password recovery, invite, email change, reauthentication. Apply Zest red/white styling matching the app templates.

## Out of scope

- No marketing/bulk emails
- No attachments (PDFs delivered as Supabase signed-URL links inside the email)
- No changes to RLS or schema
- No new cron jobs (renewals cron already exists)

## Technical notes

- Sends go through existing `/lovable/email/transactional/send` route → pgmq → cron processor. No new server routes.
- Suppression and unsubscribe are honoured automatically.
- Each new template exports `{ component, subject, displayName, previewData }` and is added to `TEMPLATES` in `registry.ts`.
- `FROM_DOMAIN` stays `zestinsurance.co.ke`, `SENDER_DOMAIN` stays `notify.zestinsurance.co.ke`.

**Files added:** 5 new templates, `src/lib/email/send.ts`
**Files edited:** `registry.ts`, client/quotation/invoice/claim dialogs and routes, `admin.import.tsx`
