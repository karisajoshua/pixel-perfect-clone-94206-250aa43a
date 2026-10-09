# Zest documentation

Documentation reflects inspected source files on `main` as of 2026-10-10. **Verified** means observed in source; **unverified** means not established by a running test or backend audit.

| Guide | Purpose |
|---|---|
| [Architecture](ARCHITECTURE.md) | Components and trust boundaries |
| [Features](FEATURES.md) | Evidence-backed module inventory |
| [Database and tenancy](DATABASE.md) | Known entities and outstanding RLS checks |
| [Integrations](INTEGRATIONS.md) | External services and callbacks |
| [Security](SECURITY.md) | Threats and validation requirements |
| [Deployment](DEPLOYMENT.md) | Build and release checks |
| [Roadmap](ROADMAP.md) | Prioritized technical validation |
| [System diagram](diagrams/system-architecture.md) | Mermaid architecture |
| [Policy flow](diagrams/policy-lifecycle.md) | Illustrative lifecycle |
| [Payment flow](diagrams/payment-flow.md) | Illustrative callback flow |

The generated route registry is `src/routeTree.gen.ts`. Do not edit it manually.
