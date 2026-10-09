# Zest Insurance Agency Platform

Insurance agency management application for clients, policies, quotations, claims, invoices, renewals, reporting and customer self-service.

> **Status:** Source-code documentation. A route or dependency does not establish production readiness. Integration, security and deployment claims require validation.

## Application areas
- **Agency workspace:** dashboard, clients, policies, quotations, claims, invoices, renewals, reports and geographic intelligence.
- **Customer portal:** policies, claims, invoices, documents, vehicles and profile.
- **Platform administration:** agencies, audit, notices and WhatsApp administration.
- **Agency administration:** users, branches, insurers, notifications, integrations, security, audit and automation.
- **Endpoints present:** AI chat, WhatsApp webhook, IPEN callbacks, M-Pesa callback, renewal reminders and email processing.

## Technology
React 19, TypeScript, TanStack Start, TanStack Router, Vite 7, Tailwind CSS 4, Supabase, PostgreSQL tooling, React Query and Radix UI. See `package.json` for exact versions.

## Getting started
1. Install dependencies using the package manager corresponding to the repository lockfile.
2. Configure required environment variables **privately** for the selected development environment. Never commit production secrets.
3. Run `npm run dev` (or the equivalent package-manager command).
4. Run `npm run lint` and `npm run build` before deployment.

The exact backend provisioning and environment-variable inventory still require verification; do not assume the commands alone yield a working installation.

## Documentation
Start at [the documentation index](docs/README.md). Architecture and flows are described in [architecture](docs/ARCHITECTURE.md); [security](docs/SECURITY.md) covers the verification checklist; [integrations](docs/INTEGRATIONS.md) separates known routes from unverified service connectivity.

## Security
This public repository must not contain secrets, customer data or confidential credentials. Report vulnerabilities privately to the repository maintainers; do not publish exploit details.

## Project identity
The existing repository name is a development-era identifier; the application identifies itself in source metadata as **Zest Insurance Agency**.
