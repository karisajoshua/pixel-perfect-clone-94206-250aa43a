# External integrations

| Integration | Source evidence | Current confidence |
|---|---|---|
| Supabase | Auth calls in `src/routes/index.tsx`; config file | Client integration observed |
| WhatsApp | Public webhook; admin and platform routes | Routes only |
| IPEN | Administration route, process express and M-Pesa callback routes | Routes only |
| DMVIC | Agency administration route | Route only |
| Email | Transactional send/preview, auth webhook and queue routes | Routes only |
| AI | `/api/chat`, assistant route, AI SDK dependencies | Route/dependency only |
| Renewal automation | Renewal reminder and automation tick routes | Routes only |

## Integration acceptance criteria
For each provider verify secret handling, webhook signature/authentication, replay protection, idempotency, timeouts, retries, reconciliation, rate limits, logging without PII and production/sandbox separation.

**Never assume an endpoint is live because it exists in the route registry.** Provider contracts and API credentials must be verified through approved private environments.
