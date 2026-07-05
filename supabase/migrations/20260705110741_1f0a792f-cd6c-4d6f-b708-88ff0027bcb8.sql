
DROP POLICY IF EXISTS "Tenant members read brand" ON storage.objects;
CREATE POLICY "Tenant members read brand" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'tenant-brand'
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.tenant_members m
        WHERE m.user_id = auth.uid()
          AND (storage.foldername(name))[1] = m.tenant_id::text
      )
    )
  );

DROP POLICY IF EXISTS "Tenant admins upload brand" ON storage.objects;
CREATE POLICY "Tenant admins upload brand" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-brand' AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.tenant_members m
        WHERE m.user_id = auth.uid()
          AND m.role IN ('admin','manager')
          AND (storage.foldername(name))[1] = m.tenant_id::text
      )
    )
  );

DROP POLICY IF EXISTS "Tenant admins update brand" ON storage.objects;
CREATE POLICY "Tenant admins update brand" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-brand' AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.tenant_members m
        WHERE m.user_id = auth.uid()
          AND m.role IN ('admin','manager')
          AND (storage.foldername(name))[1] = m.tenant_id::text
      )
    )
  );

DROP POLICY IF EXISTS "Tenant admins delete brand" ON storage.objects;
CREATE POLICY "Tenant admins delete brand" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-brand' AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.tenant_members m
        WHERE m.user_id = auth.uid()
          AND m.role IN ('admin','manager')
          AND (storage.foldername(name))[1] = m.tenant_id::text
      )
    )
  );
