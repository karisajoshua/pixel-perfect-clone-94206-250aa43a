DROP POLICY IF EXISTS user_roles_tenant_isolation ON public.user_roles;
CREATE POLICY user_roles_tenant_isolation ON public.user_roles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR user_roles.user_id = auth.uid()
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