
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  contact_email text,
  contact_phone text,
  address text,
  city text,
  country text DEFAULT 'Kenya',
  logo_url text,
  brand_primary text DEFAULT '#dc2626',
  brand_secondary text DEFAULT '#0f172a',
  brand_accent text DEFAULT '#f59e0b',
  tagline text,
  status text NOT NULL DEFAULT 'active',
  plan text NOT NULL DEFAULT 'free',
  onboarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS tenant_members_user_id_idx ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS tenant_members_tenant_id_idx ON public.tenant_members(tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_insurers (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  insurer_id uuid NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, insurer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_insurers TO authenticated;
GRANT ALL ON public.tenant_insurers TO service_role;
ALTER TABLE public.tenant_insurers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') $$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id = _tenant_id AND user_id = _user_id) $$;

DO $$
DECLARE default_tenant_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants) THEN
    INSERT INTO public.tenants (name, slug, contact_email, country, brand_primary, onboarded_at)
    VALUES ('Zest Insurance Agency', 'zest', 'zestagency64@gmail.com', 'Kenya', '#dc2626', now())
    RETURNING id INTO default_tenant_id;
  ELSE
    SELECT id INTO default_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  END IF;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  SELECT default_tenant_id, ur.user_id, ur.role
  FROM public.user_roles ur WHERE ur.role <> 'super_admin'
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.tenant_insurers (tenant_id, insurer_id)
  SELECT default_tenant_id, id FROM public.insurers
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  SELECT DISTINCT user_id, 'super_admin'::public.app_role
  FROM public.user_roles WHERE role = 'admin'
  ON CONFLICT DO NOTHING;
END $$;

DO $$
DECLARE
  default_tenant_id uuid;
  tbl text;
  owned_tables text[] := ARRAY[
    'branches','profiles','clients','vehicles','policies','quotations',
    'invoices','invoice_items','payments','claims','client_communications',
    'client_required_documents','service_requests','notifications',
    'audit_log','user_sessions'
  ];
BEGIN
  SELECT id INTO default_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  FOREACH tbl IN ARRAY owned_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE', tbl);
    EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', tbl, default_tenant_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(tenant_id)', tbl || '_tenant_id_idx', tbl);
  END LOOP;
END $$;

DO $$
DECLARE
  tbl text;
  owned_tables text[] := ARRAY[
    'branches','profiles','clients','vehicles','policies','quotations',
    'invoices','invoice_items','payments','claims','client_communications',
    'client_required_documents','service_requests','notifications',
    'audit_log','user_sessions'
  ];
BEGIN
  FOREACH tbl IN ARRAY owned_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', tbl);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON public.%I
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
        WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin())
    $f$, tbl);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Members can view their tenant" ON public.tenants;
CREATE POLICY "Members can view their tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(id) OR public.is_super_admin());

DROP POLICY IF EXISTS "Signed-in users without a tenant can create one" ON public.tenants;
CREATE POLICY "Signed-in users without a tenant can create one" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (public.current_tenant_id() IS NULL OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant admins can update their tenant" ON public.tenants;
CREATE POLICY "Tenant admins can update their tenant" ON public.tenants
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.tenant_members m
      WHERE m.tenant_id = tenants.id AND m.user_id = auth.uid()
        AND m.role IN ('admin','manager')
    )
  );

DROP POLICY IF EXISTS "Members can see their memberships" ON public.tenant_members;
CREATE POLICY "Members can see their memberships" ON public.tenant_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_tenant_member(tenant_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "New tenant creator adds themselves" ON public.tenant_members;
CREATE POLICY "New tenant creator adds themselves" ON public.tenant_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tenant_members m
      WHERE m.tenant_id = tenant_members.tenant_id AND m.user_id = auth.uid()
        AND m.role IN ('admin','manager')
    )
  );

DROP POLICY IF EXISTS "Tenant admins can remove members" ON public.tenant_members;
CREATE POLICY "Tenant admins can remove members" ON public.tenant_members
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.tenant_members m
      WHERE m.tenant_id = tenant_members.tenant_id AND m.user_id = auth.uid()
        AND m.role IN ('admin','manager')
    )
  );

DROP POLICY IF EXISTS "Members read their tenant insurers" ON public.tenant_insurers;
CREATE POLICY "Members read their tenant insurers" ON public.tenant_insurers
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant admins manage insurers" ON public.tenant_insurers;
CREATE POLICY "Tenant admins manage insurers" ON public.tenant_insurers
  FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.tenant_members m
      WHERE m.tenant_id = tenant_insurers.tenant_id AND m.user_id = auth.uid()
        AND m.role IN ('admin','manager')
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.tenant_members m
      WHERE m.tenant_id = tenant_insurers.tenant_id AND m.user_id = auth.uid()
        AND m.role IN ('admin','manager')
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_creator_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE tid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  tid := public.current_tenant_id();
  IF tid IS NULL THEN
    RAISE EXCEPTION 'You are not a member of any agency. Complete onboarding first.';
  END IF;
  NEW.tenant_id := tid;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
  owned_tables text[] := ARRAY[
    'branches','profiles','clients','vehicles','policies','quotations',
    'invoices','invoice_items','payments','claims','client_communications',
    'client_required_documents','service_requests','notifications',
    'audit_log','user_sessions'
  ];
BEGIN
  FOREACH tbl IN ARRAY owned_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_set_tenant', tbl);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_tenant()', tbl || '_set_tenant', tbl);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  matched_client uuid;
  default_tenant_id uuid;
BEGIN
  SELECT id INTO default_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.profiles (id, full_name, email, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    default_tenant_id
  );

  SELECT id INTO matched_client FROM public.clients
  WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL
  LIMIT 1;

  IF matched_client IS NOT NULL THEN
    UPDATE public.clients SET auth_user_id = NEW.id WHERE id = matched_client;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    SELECT tenant_id, NEW.id, 'client' FROM public.clients WHERE id = matched_client
    ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET tenant_id = (SELECT tenant_id FROM public.clients WHERE id = matched_client)
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
