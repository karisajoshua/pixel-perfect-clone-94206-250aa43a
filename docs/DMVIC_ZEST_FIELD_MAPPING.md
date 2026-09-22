# Zest → DMVIC Motor UAT mapping

Status: gateway health and DMVIC UAT mTLS/login verified. This defines the application mapping boundary before certificate issuance is enabled.

## Flow

Zest motor quote → quote confirmation → payment/policy confirmation → DMVIC payload completion → DMVIC validation/preview → explicit issuance → persist DMVIC references/PDF metadata.

DMVIC issuance must not run from the browser or merely because a quote was generated. All DMVIC calls go through authenticated server functions and the Render mTLS gateway.

## Type A field map

| DMVIC field | Zest source | State |
| --- | --- | --- |
| TypeOfCertificate | approved certificate/product mapping | mapping required |
| MemberCompanyID | selected insurer/member-company mapping | mapping required |
| Typeofcover | approved cover-option → DMVIC 100/200/300 mapping | mapping required |
| Policyholder | client full name | available |
| policynumber | confirmed policy/proposal response | verify exact source |
| Commencingdate | confirmed commencement date, DD/MM/YYYY | available after confirmation |
| Expiringdate | confirmed policy expiry date | verify exact source |
| Registrationnumber | motor wizard registration number | available |
| Chassisnumber | vehicle/policy record | currently missing from quote wizard |
| Phonenumber | client/payment phone | available |
| Bodytype | vehicle record | currently missing from quote wizard |
| Licensedtocarry | vehicle record | currently missing from quote wizard |
| Vehiclemake | selected vehicle make | available as ID; resolve DMVIC text/value |
| Vehiclemodel | selected vehicle model | available as ID; resolve DMVIC text/value |
| Enginenumber | vehicle record | optional / not currently in quote wizard |
| Email | client email | available |
| SumInsured | vehicle value | available; required for applicable cover types |
| InsuredPIN | client KRA PIN / policyholder record | currently missing from quote wizard |
| Yearofmanufacture | motor wizard year | available |
| HudumaNumber | client record | optional |

Yearofregistration remains in the current validation schema but the supplied DMVIC documentation shows it struck through. Do not make it a blocking UI field until UAT/docs confirm it.

## Existing Zest → DMVIC mapping work

The motor quote wizard already captures risk class/category, cover option, motor type/use, make/model, registration, year, vehicle value, phone and client email. DMVIC schemas/server functions already support preview, validate, issue, member-company stock and explicit policy-alert confirmation.

The remaining integration work is data completion and canonical mappings, not a second quote engine.

## Guardrails before issuance

1. Create canonical insurer/member-company and cover-type mappings; never infer DMVIC numeric IDs from display names.
2. Add/resolve chassis number, body type, licensed-to-carry, insured PIN, policy number and expiry date from authoritative Zest policy/vehicle/client records.
3. Run DMVIC validate/preview before issuance and surface ER005/ER006/ER007 without consuming stock.
4. ER007/policy-alert confirmation stays human-driven. Do not auto-confirm.
5. Persist DMVIC transaction/reference/certificate identifiers and certificate delivery/PDF metadata only after successful issuance.
6. Do not log DMVIC credentials, bearer tokens, PFX material, gateway token, or full PII request/response bodies.
7. Verify the intermediary endpoint/version discrepancy for confirmation before enabling it in production flow.

## Deployment boundary

The Zest server runtime needs only DMVIC_GATEWAY_URL and DMVIC_GATEWAY_TOKEN.

The DMVIC username/password, ClientID, PFX and PFX passphrase remain only on the Render gateway.
