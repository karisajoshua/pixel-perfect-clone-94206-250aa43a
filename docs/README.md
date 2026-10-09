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

## Phase 2 — Insurance operations and integrations

- [Insurance workflows](INSURANCE_WORKFLOWS.md) — quotations, claims and renewals, with validation checkpoints.
- [DMVIC and IPEN](DMVIC_IPEN.md) — source-backed integration and payment callback review.
- [WhatsApp and email](WHATSAPP_EMAIL.md) — messaging configuration and verification.
- [Automation](AUTOMATION.md) — scheduler, renewal reminders and reliability checks.
- [AI assistant](AI_ASSISTANT.md) — both assistant paths and privacy requirements.
- [Agency staff guide](USER_GUIDE.md) — initial role-based navigation reference.
- [Administrator guide](ADMIN_GUIDE.md) — initial administration reference.

These guides document inspected code; live integration, access-control and workflow tests remain outstanding.

## Additional Phase 2 operational references

- [Client, policy and billing operations](CLIENT_POLICY_BILLING.md)
- [Role and navigation guide](ACCESS_ROLES.md)
- [Renewal email and automation runbook](RENEWAL_EMAIL_RUNBOOK.md)
- [Verification matrix](VERIFICATION_MATRIX.md)

These are source-based references; production testing is still required.

## Phase 3 — Manuals, release readiness and branding

- [Agency staff manual](USER_GUIDE.md) — expanded workflows and troubleshooting.
- [Administrator operations manual](ADMIN_GUIDE.md) — roles, integrations and daily controls.
- [Deployment and release runbook](DEPLOYMENT.md) — scripts, environment checklist and release gates.
- [Brand assets and screenshot plan](BRAND_ASSETS.md) — approved imagery requirements.
- [Documentation change log](CHANGELOG.md) — documentation milestones.
- [Release notes template](RELEASE_TEMPLATE.md) — standard release reporting.
- [Phase 3 acceptance checklist](PHASE3_ACCEPTANCE.md) — completed work and pending verification.

Screenshots and live deployment verification are still pending; no production changes were made.
