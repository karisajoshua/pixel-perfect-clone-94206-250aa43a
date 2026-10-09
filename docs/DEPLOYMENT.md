# Development, Deployment and Release Runbook

**Edition:** Phase 3, 10 October 2026. No production deployment or build was performed during this documentation update.

## 1. Source and tooling
The application uses React 19, TypeScript, TanStack Start 1.168.60, Vite 7, Tailwind CSS 4 and Supabase. The package name remains `tanstack_start_ts` in `package.json`.

### Defined package scripts
| Command | Script | Purpose |
| --- | --- | --- |
| `npm run dev` | `vite dev` | Development |
| `npm run build` | `vite build` | Production build |
| `npm run build:dev` | `vite build --mode development` | Development-mode build |
| `npm run preview` | `vite preview` | Local preview |
| `npm run lint` | `eslint .` | Lint |
| `npm run format` | `prettier --write .` | Formatting |
| `npm run docs:openapi` | `bun run scripts/generate-openapi.ts` | OpenAPI generation |

Use the repository lockfile to select the package manager and reproducible installation command. The existence of a script does not confirm it passes.

## 2. Environment inventory
A verified complete variable inventory is **not available**. Source-reviewed routes reference the following names:

| Variable | Source context | Handling |
| --- | --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Meta webhook GET verification | Server secret |
| `WHATSAPP_APP_SECRET` | Meta webhook POST signature | Server secret |
| `IPEN_CALLBACK_SECRET` | IPEN M-Pesa callback routes | Server secret |
| `AUTOMATION_TICK_SECRET` | Automation tick endpoint | Server secret |
| `RENEWAL_HOOK_SECRET` | Renewal reminder hook | Server secret |

Other backend, Supabase, email, provider and AI credentials must be inventoried from source and deployment settings. **Never commit values.** Configure separate development, staging and production credentials.

## 3. Pre-deployment gates
1. Pin commit and lockfile; confirm runtime and dependency compatibility.
2. Install dependencies using the matching package manager.
3. Run lint, build and any configured tests. Record results.
4. Verify database migrations, RLS, role enforcement and service-role isolation.
5. Test login, MFA, client records, quotation conversion, policy creation, claims and invoices with synthetic data.
6. Test provider callbacks, retries and duplicate requests in sandbox environments.
7. Verify email sender domain, WhatsApp templates, consent and suppression.
8. Confirm scheduled jobs, job locking, time zones and observability.
9. Confirm backup restore and rollback procedure.
10. Verify site metadata and social previews; root metadata previously contained a Lovable attribution.

## 4. Release record template
- Commit SHA:
- Release owner:
- Environment:
- Migration set:
- Lint/build/test evidence:
- Security sign-off:
- Integration sandbox results:
- Backup and rollback reference:
- Release time and outcome:

## 5. Post-deployment checks
Confirm health and authentication, tenant isolation, key insurance journeys, callback logs, job queues, provider delivery and error metrics. Roll back when financial integrity or customer confidentiality cannot be assured.

## 6. Outstanding evidence
Hosting topology, actual secrets inventory, CI pipelines, build status, database migrations, observability and recovery procedures have not been independently verified.
