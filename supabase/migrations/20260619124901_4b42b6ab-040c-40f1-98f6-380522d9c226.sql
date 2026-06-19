
CREATE POLICY "Staff manage claim docs" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'claim-documents' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent')
  ))
  WITH CHECK (bucket_id = 'claim-documents' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent')
  ));

CREATE POLICY "Clients read own claim docs" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'claim-documents'
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id::text = split_part(name, '/', 1)
        AND c.client_id = public.current_client_id()
    )
  );

CREATE POLICY "Clients upload own claim docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'claim-documents'
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id::text = split_part(name, '/', 1)
        AND c.client_id = public.current_client_id()
    )
  );
