# Development and deployment

## Verified package scripts
- `npm run dev` — Vite development server.
- `npm run build` — production build.
- `npm run preview` — local build preview.
- `npm run lint` — ESLint.

Choose the package manager from the actual lockfile. Production hosting, runtime secrets and CI configuration have **not been verified**.

## Release checklist
1. Confirm target environment and runtime compatibility.
2. Provision Supabase resources and secrets privately.
3. Run lint, type checks as configured, build and smoke tests.
4. Verify migrations, RLS and least-privilege service credentials.
5. Exercise auth, tenant separation, policy and invoice workflows using test data.
6. Test payment and messaging callbacks in sandbox mode.
7. Confirm backups, monitoring, rollback and incident response.
8. Verify branded metadata and social previews; root metadata currently includes `@Lovable` Twitter attribution.

Never commit production credentials or publish private callback signing secrets.
