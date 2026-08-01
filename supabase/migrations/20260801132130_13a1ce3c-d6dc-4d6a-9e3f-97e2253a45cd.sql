CREATE OR REPLACE FUNCTION public.current_client_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT tenant_id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1 $$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clients','vehicles','policies','quotations','invoices','invoice_items','payments',
    'claims','client_communications','client_required_documents','service_requests',
    'branches','audit_log','notifications','user_sessions','policy_payment_extensions',
    'tenant_insurers'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_strict ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation_strict ON public.%I
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (
        tenant_id IS NULL
        OR tenant_id = public.current_tenant_id()
        OR tenant_id = public.current_client_tenant_id()
        OR public.is_super_admin()
      )
      WITH CHECK (
        tenant_id IS NULL
        OR tenant_id = public.current_tenant_id()
        OR tenant_id = public.current_client_tenant_id()
        OR public.is_super_admin()
      )
    $f$, t);

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND 'public' = ANY(roles)
    LOOP
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;