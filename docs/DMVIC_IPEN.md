# DMVIC and IPEN integration guide

## DMVIC
**Source:** `src/routes/_authenticated/admin.dmvic.tsx` requires admin. It invokes `dmvicConnectionStatus` and queries `dmvic_certificate_orders`, `dmvic_certificate_prices`, `motor_insurer_rates`, `insurers`, `tenants` and `dmvic_settlements`. The page includes certificate pricing, insurer rate configuration, order progress and settlement/reconciliation summaries.

**Do not infer:** that certificates can currently be issued, pricing is correct, or settlement has been reconciled with DMVIC. Verify the server function, provider API and ledger transitions.

## IPEN
**Source:** `src/routes/_authenticated/admin.ipen.tsx` requires admin, manager or agent. Imports server functions for connection/registration, MFA, health checks, policies, claims, profile, portal dashboard, M-Pesa Express and OCR.

**Payment callback:** `src/routes/api/public/ipen/mpesa-callback.ts` checks the `x-ipen-callback-secret` header against `IPEN_CALLBACK_SECRET`, parses several STK callback shapes and matches `CheckoutRequestID` to `payments.ipen_checkout_request_id`. It references certificate payment state progression.

**Important review finding:** the callback accepts a static shared-secret header and includes permissive CORS headers. Assess whether provider authentication, constant-time comparison, replay prevention, idempotent state changes and error handling meet the intended threat model. Never treat an HTTP 200 as proof of reconciliation.

## Acceptance tests
1. Confirm sandbox provider identity and endpoint authentication.
2. Submit valid, invalid and duplicate callbacks.
3. Verify only the intended payment/invoice is updated.
4. Verify failed payments cannot trigger certificate issuance.
5. Reconcile certificate liabilities and settlements independently.
6. Ensure tenant A cannot inspect tenant B's orders or rates.
