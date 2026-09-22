# DMVIC Motor Integration — Engineering Handover & Change Log

This is the repository-side technical handover for Zest Insurance's DMVIC Motor integration. Update it with every material DMVIC change: what changed, why, tests/results, security or compatibility implications, and the next blocker. Never record credentials, ClientID values, passwords, PFX/private-key material, tokens, subscription keys, or customer PII.

## Authoritative architecture

Current `main` is authoritative. The Zest application runs in a runtime that cannot directly load the PKCS#12 client certificate, so the integration supports:

**Zest app/server functions → protected Node mTLS gateway → DMVIC UAT**

Primary files:
- `src/lib/dmvic/dmvic-client.server.ts` — transport/authentication.
- `src/lib/dmvic/dmvic.functions.ts` — authenticated server functions.
- `src/lib/dmvic/types.ts` — paths/client-safe types.
- `src/lib/dmvic/errors.ts` — alert normalization.
- `src/lib/dmvic/schemas.ts` — request validation.
- `dmvic-gateway/server.js` — Node mTLS gateway.
- `dmvic-gateway/render.yaml` — gateway deployment definition.

## Change log

### 2026-09-22 — Reconciled validation onto current main architecture

**What changed**
- Started from current `main` rather than merging the older divergent feature implementation.
- Added Zod validation for shared certificate fields and Type A–D-specific fields.
- Server preview/validate/issue functions now use a discriminated Type A–D request schema.
- Conditional `SumInsured` validation is enforced for Comprehensive/TPTF.

**Why**
The prior feature branch and main independently implemented DMVIC. Main already contained the newer application server functions, normalized errors and Node mTLS gateway. Porting validation onto main avoids duplicate transports/gateways and preserves changes synchronized from the app/Lovable workflow.

**Compatibility**
DMVIC documentation has field discrepancies, particularly around Type B/D. Schemas use `.passthrough()` and intentionally avoid over-constraining unresolved tonnage/licensed-to-carry fields until UAT establishes the accepted contract.

**Testing**
Static reconciliation completed. Real UAT connectivity is not yet claimed. Protected gateway/runtime secrets must be configured before authentication testing.

## Security and implementation rules

- DMVIC credentials and PFX material remain server/gateway-only.
- Never log request/response bodies containing PII or authentication material.
- Never disable TLS server verification.
- Never automatically confirm ER007 policy alerts; require explicit staff review.
- Keep endpoint versions explicit because DMVIC mixes API versions.
- Preserve all DMVIC alerts, including multiple ER007 entries.
- Do not force-merge the older `feature/dmvic-uat-integration` branch into main.
- A historically tracked `.env` remains security debt; ignoring it does not erase Git history. Identify and rotate affected secrets before production go-live.

## Next execution milestone

Configure protected gateway/runtime secrets and run UAT in this order: gateway health → DMVIC login/authentication → stock → preview → validate → issue → verified status/cancellation operations. Update this document with each confirmed result.
