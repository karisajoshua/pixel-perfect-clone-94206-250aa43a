# Stop other agencies' clients appearing in your list

## What's happening

The database has three agencies: Zest Insurance Agency (948 clients), Britam (1) and ZYTA Insurance Agency (1). A client belonging to another agency is showing in your list.

Cause, confirmed against the live access rules: each tenant-scoped table has an agency-isolation rule, but it sits *alongside* the staff role rules rather than *above* them. Postgres combines rules of the same kind with OR, so a rule like "admins/managers/agents can read clients" — which has no agency condition — grants access on its own and cancels out the agency check. The same shape exists on clients, policies, vehicles, quotations, invoices, invoice items, payments, claims, communications, service requests and branches.

## Fix

1. Convert agency isolation into an overriding rule (a RESTRICTIVE policy) on every table that carries an agency id. Access then requires **both** the agency match **and** a role rule. Role rules stay exactly as they are — no change to who can do what inside an agency.
2. Keep platform super admins able to see across agencies, and keep portal clients able to see their own records even if their agency membership row is missing, by matching on the agency of their own client record.
3. Tighten the handful of staff rules currently granted to the broad `public` database role so they apply to signed-in users only.
4. Re-run the agency separation check afterwards: confirm a Zest admin sees 948 clients and zero Britam/ZYTA rows, and vice versa.

## Technical notes

- New helper `public.current_client_tenant_id()` (security definer) returning `tenant_id` from `clients` where `auth_user_id = auth.uid()`.
- For each table with `tenant_id`: `CREATE POLICY tenant_isolation_strict ... AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id() OR tenant_id = public.current_client_tenant_id() OR public.is_super_admin()) WITH CHECK (same)`; existing permissive `tenant_isolation` policies dropped to avoid duplication.
- Tables covered: clients, vehicles, policies, quotations, invoices, invoice_items, payments, claims, client_communications, client_required_documents, service_requests, branches, audit_log, notifications, user_sessions, policy_payment_extensions, tenant_insurers.
- Existing role policies recreated `TO authenticated` where they currently target `public`.
- No frontend changes; queries already filter by client/agency implicitly.
