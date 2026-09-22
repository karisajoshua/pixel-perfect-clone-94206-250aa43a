# Zest DMVIC mTLS Gateway

A minimal Node.js gateway for the Zest Insurance DMVIC UAT integration. It exists because the published Lovable edge runtime cannot load a PKCS#12/PFX client certificate with Node TLS.

## Security

All DMVIC credentials, the base64 PFX and its passphrase stay in server environment variables. Never commit them. The gateway accepts only an allow-listed set of DMVIC operations and requires a separate `DMVIC_GATEWAY_SHARED_SECRET` from Zest on every request.

Do not expose this service without HTTPS. Put it behind a trusted Node hosting platform/reverse proxy and restrict network access where possible.

## API

- `GET /health` — non-secret readiness metadata.
- `POST /dmvic/login-test` — tests mTLS + DMVIC login and returns metadata only, never the token.
- `POST /dmvic/:operation` — allow-listed authenticated proxy. Body: `{ "payload": {...} }`.

Operations: `preview-a`, `preview-b`, `preview-c`, `preview-d`, `validate-a`, `validate-b`, `validate-c`, `validate-d`, `issue-a`, `issue-b`, `issue-c`, `issue-d`, `stock`, `confirm`.

The `confirm` operation uses the formally documented DMVIC v6 endpoint. It is not called automatically after ER007.

## Required server secrets

`DMVIC_UAT_BASE_URL`, `DMVIC_UAT_USERNAME`, `DMVIC_UAT_PASSWORD`, `DMVIC_UAT_CLIENT_ID`, `DMVIC_UAT_CLIENT_CERT` (base64 PFX), `DMVIC_UAT_CLIENT_CERT_PASSWORD`, and `DMVIC_GATEWAY_SHARED_SECRET`.
