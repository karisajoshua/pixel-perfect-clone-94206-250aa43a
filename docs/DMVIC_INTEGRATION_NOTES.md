# DMVIC Motor Integration — Engineering Handover & Change Log

This document is the GitHub-side technical handover for the Zest Insurance DMVIC Motor integration.

## Documentation rule

Every material DMVIC integration change should update this file in the same branch/PR. Record:
- date;
- files/components changed;
- what changed;
- why the change was required;
- security or compatibility considerations;
- testing performed and result;
- remaining blocker/next step.

Do not record credentials, ClientID values, passwords, PFX/private-key material, tokens, APIM subscription keys, or customer PII here.

## Current architecture

DMVIC calls are server-side only. Browser/client code must not receive DMVIC credentials or certificate material.

Primary integration module:
- `src/lib/dmvic/dmvic.server.ts`

Environment-variable contract:
- `.env.example`

Working branch:
- `feature/dmvic-uat-integration`

## Change log

### 2026-09-22 — Initial server-side integration boundary

**What changed**
- Added a server-only DMVIC integration module.
- Added PKCS#12/PFX mTLS transport.
- Added DMVIC Login API support and token caching.
- Added Bearer token + ClientID authentication for subsequent requests.
- Added Type A–D preview, validation, and issuance endpoint maps.
- Added Member Company Stock lookup.
- Added normalization for both standard `Error[]` and policy-alert `Errors[]` response shapes.
- Added guarded certificate-issuance confirmation support.

**Why**
DMVIC requires an X.509 client certificate plus API authentication. Keeping this boundary server-side prevents credentials/private-key material from reaching the browser and centralizes DMVIC-specific behavior.

**Important compatibility note**
DMVIC documentation contains endpoint/schema inconsistencies. In particular, policy-alert text references a V5 `ConfirmCertificateIssuance` endpoint while captured documentation supports a V6 endpoint. Confirmation must remain controlled until UAT verifies the accepted contract.

### 2026-09-22 — Environment/security scaffolding

**What changed**
- Added `.env.example` with placeholders for UAT base URL, username, password, ClientID, base64 PFX and PFX password.
- Updated ignore rules for local environment files and certificate/private-key formats.

**Why**
Real DMVIC secrets must be supplied through protected server/deployment secret management and never committed.

**Security debt**
A real `.env` had previously been tracked in the repository. Ignore rules prevent future accidental additions but do not remove historical exposure. Identify affected secrets, remove tracked secret material safely, and rotate affected credentials where required.

## Current status

The code foundation is ready for UAT configuration. The next milestone is real authentication/connectivity.

Planned UAT sequence:
1. Configure protected UAT secrets.
2. DMVIC Login.
3. Member-company stock.
4. Certificate preview.
5. Certificate validation.
6. Certificate issuance.
7. Insurance/status and cancellation operations once remaining contracts are verified.
8. Integrate verified calls into the Zest motor policy workflow.

## Implementation rules for future teams

- Never call DMVIC directly from browser/client code.
- Never log authentication headers, passwords, PFX data/passphrases, tokens, subscription keys, or full customer payloads.
- Keep API versions explicit per endpoint; DMVIC currently mixes versions.
- Preserve individual DMVIC business-rule errors instead of collapsing them into generic failures.
- Treat Double Insurance and insufficient inventory as business outcomes, not merely transport errors.
- Do not infer request fields from contradictory documentation examples; verify ambiguous fields in UAT.
- Update this document whenever the integration contract, transport, schemas, workflow, or deployment requirements change.
