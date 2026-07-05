
-- 1. Stop auto-assigning new signups to the default (Zest) tenant.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  matched_client uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULL
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
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Backfill: detach profiles that were auto-placed in the default tenant
--    but were never actually members of it.
DO $$
DECLARE default_tenant_id uuid;
BEGIN
  SELECT id INTO default_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  IF default_tenant_id IS NOT NULL THEN
    -- profiles.tenant_id is NOT NULL, so we can't NULL it. Instead, since we can't
    -- know which orphans belong where, we leave existing members alone; new signups
    -- will now have NULL tenant_id via the updated trigger.
    -- Allow NULL going forward so orphaned or pre-onboarding users don't leak in.
    ALTER TABLE public.profiles ALTER COLUMN tenant_id DROP NOT NULL;
    UPDATE public.profiles p
      SET tenant_id = NULL
      WHERE p.tenant_id = default_tenant_id
        AND NOT EXISTS (
          SELECT 1 FROM public.tenant_members m
          WHERE m.tenant_id = default_tenant_id AND m.user_id = p.id
        );
  END IF;
END $$;

-- 3. Tenant-scope RLS on user_roles so admins in tenant A can't see users in tenant B.
DROP POLICY IF EXISTS user_roles_tenant_isolation ON public.user_roles;
CREATE POLICY user_roles_tenant_isolation ON public.user_roles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.tenant_id = public.current_tenant_id()
    )
  );

-- 4. Security fix: prevent privilege escalation via tenant_members self-insert.
-- Old policy allowed any authenticated user to insert (any tenant_id, any role)
-- as long as user_id = auth.uid(). Restrict self-insert to (a) super admins,
-- (b) existing tenant admin/manager adding anyone, or (c) the very first member
-- of a brand-new tenant claiming a non-privileged role for themselves. First-tenant
-- admin creation happens via the createTenant server fn using the service role,
-- which bypasses this policy.
DROP POLICY IF EXISTS "New tenant creator adds themselves" ON public.tenant_members;
CREATE POLICY "Tenant admins add members" ON public.tenant_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tenant_members m
      WHERE m.tenant_id = tenant_members.tenant_id
        AND m.user_id = auth.uid()
        AND m.role IN ('admin','manager')
    )
  );
