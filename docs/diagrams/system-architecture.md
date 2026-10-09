# System architecture (logical, not infrastructure-verified)

```mermaid
flowchart TB
  A[Agency staff browser] --> W[TanStack Start application]
  C[Customer portal browser] --> W
  P[Platform administrator] --> W
  W --> AUTH[Supabase Auth]
  W --> DB[(Supabase PostgreSQL)]
  W --> API[Server API routes]
  API --> EXT[Insurance / payment / messaging providers]
  API --> AI[AI model provider]
  EXT --> CB[Public callback endpoints]
  CB --> API
```

**Trust boundary:** Every browser request and public callback must be authorized and validated server-side. Tenant isolation and deployed infrastructure remain unverified.
