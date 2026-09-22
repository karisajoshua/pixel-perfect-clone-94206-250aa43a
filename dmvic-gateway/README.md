# DMVIC mTLS gateway

Zest app (Cloudflare Worker) -> this gateway (Node on Render) -> DMVIC UAT.

The Worker runtime has no Node TLS stack, so the PKCS#12 client certificate can
only be presented from a Node host. This service is that host.

## Why this version cannot fail a Render build

- No npm dependencies at all, so install cannot fail on resolution, lockfile
  mismatch, private registries, or the 24h release guard.
- No build step, no TypeScript, no bundler. `build` only runs `node --check`.
- No `bun.lock` / `package-lock.json` conflict: there is nothing to lock.

## Render settings

- Root directory: `dmvic-gateway`
- Environment: Node
- Build command: `npm install --no-audit --no-fund`
- Start command: `node server.js`
- Health check path: `/health`

## Environment variables (Render dashboard only — never committed)

`DMVIC_UAT_BASE_URL`, `DMVIC_UAT_USERNAME`, `DMVIC_UAT_PASSWORD`,
`DMVIC_UAT_CLIENT_ID`, `DMVIC_UAT_CLIENT_CERT` (base64 PKCS#12/PFX),
`DMVIC_UAT_CLIENT_CERT_PASSWORD`, `DMVIC_GATEWAY_TOKEN` (shared secret the Zest
app sends as `Authorization: Bearer ...`).

## API

- `GET /health` -> `{ ok, configured, missing: string[] }`. Names only, never values.
- `POST /dmvic` with `Authorization: Bearer <DMVIC_GATEWAY_TOKEN>` and body
  `{ "path": "/api/v7/IntermediaryIntegration/PreviewTypeACertificate", "body": { ... } }`
  -> `{ status, text }` where `text` is DMVIC's raw response body.

Login and bearer-token caching happen inside the gateway. Callers never see
DMVIC credentials or tokens. Only method, path and HTTP status are logged.
