# Architecture

## Verified components
- React 19 + TanStack Start frontend and server routing, configured through `vite.config.ts`.
- Supabase client authentication in `src/routes/index.tsx`; role and tenant membership lookups.
- Distinct agency, customer portal and platform route groups in `src/routeTree.gen.ts`.
- Shared root shell in `src/routes/__root.tsx`, including query caching, error handling and tenant brand cache reset.
- API route entries for AI chat, public callbacks, renewal automation and email processing.

## Access model
After authentication, the login page queries `user_roles` and `tenant_members`, routing customer-only users to `/portal`, agency members to `/dashboard`, and users without an agency to onboarding (subject to special super-admin logic).

**Important:** Client-side route selection is not an authorization boundary. Server handlers and database policies must independently enforce every access check.

## Trust boundaries
1. Browser ↔ application server.
2. Application server ↔ Supabase authentication/database.
3. Public callbacks ↔ payment, messaging and insurance providers.
4. Agency tenant ↔ other tenants.
5. AI assistant ↔ authorized business data.

See [system diagram](diagrams/system-architecture.md). Service-side enforcement and infrastructure are **not yet audited**.
