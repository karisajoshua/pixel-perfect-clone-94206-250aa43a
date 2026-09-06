# IPEN go-live: map every endpoint into the daily workflow

Today IPEN works, but most endpoints only live on the Admin > IPEN "explorer" page. Going live means each endpoint has a real home in the staff and client flow, results are written back into our own records, and the connection survives outages without breaking screens.

Defaults chosen (you skipped the questions): sandbox/live switch per agency, full end-to-end flow (quote -> confirm -> M-Pesa -> documents -> claims), IPEN policies auto-create/attach to local covers, and IPEN M-Pesa only for IPEN-underwritten covers (local receipts stay for everything else).

## 1. Environment switch (sandbox <-> live)

- Add a `LIVE` base URL secret alongside the sandbox one; Admin > IPEN gets an "Environment" selector (Sandbox / Live) stored per agency.
- Switching environments clears stored tokens and asks the admin to reconnect (credentials differ per environment).
- A clear "LIVE" / "SANDBOX" badge is shown on every IPEN-powered dialog so staff never mix them up.

## 2. Endpoint-to-screen map

```text
Auth
  Register / Login / verify-mfa / refresh / logout / forgot-password  -> Admin > IPEN (already built; kept)
Common (reference data)
  countries, ID docs, genders, relationships, makes, models,
  motor-types, vehicle-uses, risk-classes, cover-options, products  -> dropdowns inside the quote wizard + vehicle form (cached)
  customer-vehicles                                                  -> client Vehicles tab: "Import from IPEN" button
Policy
  generate-quotes                -> Quotation page: "Quote via IPEN" (motor) using the client + vehicle already on file
  confirm-quote                  -> Quotation "Convert" step when the quote came from IPEN
  policies / policy/{id}         -> Policies list: "Sync from IPEN" + live drawer on each IPEN cover
  life-products / frequencies /
  create-life-quote / confirm /
  benefits-schedule              -> Life quote wizard (already on Quotations; add PDF of benefits schedule)
  initialize-payment             -> Invoice page: "Collect via IPEN M-Pesa" (IPEN covers only)
PaymentDetails
  InitiateMpesaExpress           -> Invoice page + Policy page "Pay by M-Pesa" (STK push to client phone)
  ConfirmMpesaPayment/{proposal} -> automatic poll after STK push; creates our receipt + runs the payment sync
  ProcessPayment                 -> fallback "Record IPEN payment" when STK confirmation is manual
Claim
  create-claim                   -> New claim dialog: "Also file with IPEN" toggle (IPEN covers only)
  user-claims / claim-details    -> Claims page: IPEN status column + detail drawer
Documents
  content/{key}                  -> Certificate / policy schedule download buttons on the cover card and client portal
Profile / Portal
  profile, update, photo, portal dashboard -> Client portal (already built; kept)
OCR
  extract                        -> Vehicle form + client form: "Scan logbook / ID" button (already built; kept on forms)
Assistant
  chat                           -> Assistant page (already built; kept)
```

## 3. Write-back rules (so our records stay the source of truth)

- Confirming an IPEN quote creates or updates the local policy with IPEN policy id, policy no., certificate no., start/end dates and premium, and links the quotation.
- Confirmed M-Pesa payments create a local receipt and run the existing chain-aware payment sync, so balances on Vehicles/Billing/Dashboard update immediately.
- Filing a claim to IPEN stores the IPEN claim id on our claim; claim status is refreshed on open.
- "Sync from IPEN" on Policies matches by policy no. / registration and offers "Attach to existing cover" for older records rather than duplicating.

## 4. Resilience

- All read endpoints return a soft "IPEN unavailable" notice instead of crashing (done for policies/claims/profile/portal; extend to the rest).
- Token refresh on 401 already exists; add a nightly-style check that warns the admin bell when the IPEN connection is expired.
- Every IPEN call logs to an `ipen_call_log` table (endpoint, status, duration, agency) so failures can be traced per agency.

## 5. Go-live checklist (in-app, Admin > IPEN)

Environment set to Live, connection verified, reference data loaded, one test quote confirmed, one STK push confirmed, one document downloaded. Each step shows a green tick.

## Technical details

- New secret `IPEN_API_BASE_URL_LIVE`; `ipen-fetch.server.ts` picks base URL from the agency's stored `environment` column (`ipen_agency_credentials.environment text default 'sandbox'`).
- New columns: `policies.ipen_certificate_no`, `receipts.ipen_transaction_ref` (exists), `claims.ipen_status`; new table `ipen_call_log` with tenant-scoped RLS + grants.
- New server functions: `syncIpenPolicies`, `confirmMpesaAndRecord`, `importCustomerVehicles`, `refreshIpenClaimStatus`; reuse `policy-payment-sync.ts` and `invalidatePaymentViews`.
- Components: extend `motor-quote-wizard` to accept an existing vehicle, add `IpenPayButton`, `IpenSyncPoliciesButton`, `IpenDocumentButtons`, `IpenGoLiveChecklist`.
- The Admin > IPEN explorer stays as a diagnostics tab.
