# WhatsApp and email — source-based operations guide

## WhatsApp
**Source:** `src/routes/_authenticated/admin.whatsapp.tsx` requires admin or manager. The page invokes functions for channel configuration, connection tests, message templates, test sends and consent settings. It also displays activity. The overview query refreshes every 20 seconds.

**Webhook:** `src/routes/api/public/whatsapp/webhook.ts` supports Meta verification GET using `WHATSAPP_VERIFY_TOKEN` and POST signature verification using `WHATSAPP_APP_SECRET` before calling `processWhatsAppWebhook`.

**Validation needed:** actual Meta app configuration, consent evidence, approved templates, per-tenant channel separation, retry and idempotency implementation, and delivery-state reconciliation.

## Email
The generated route tree includes transactional send/preview, queue processing, auth webhook/preview, suppression and unsubscribe endpoints.

**Validation needed:** sender domain authentication (SPF/DKIM/DMARC), suppression enforcement, queue retries, bounce handling, tenant separation and permission checks. The route inventory alone does not establish these controls.

## Operator checklist
- Use test contacts and sandbox credentials.
- Do not send bulk or production messages during validation.
- Verify opt-in/opt-out behavior and privacy requirements.
- Capture provider event IDs and avoid duplicate sends.
