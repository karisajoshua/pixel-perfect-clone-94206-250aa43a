
CREATE POLICY "client docs read staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents');
CREATE POLICY "client docs upload staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents');
CREATE POLICY "client docs update staff" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-documents');
CREATE POLICY "client docs delete staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND public.has_role(auth.uid(), 'admin'));
