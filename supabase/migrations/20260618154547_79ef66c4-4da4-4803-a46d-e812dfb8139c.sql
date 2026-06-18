
-- Clients can upload to their own folder in client-documents bucket
CREATE POLICY "Client can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (public.current_client_id())::text
);

CREATE POLICY "Client can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (public.current_client_id())::text
)
WITH CHECK (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (public.current_client_id())::text
);

CREATE POLICY "Client can delete own documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (public.current_client_id())::text
  AND (storage.foldername(name))[2] = 'kyc'
);

-- Tighten client_communications insert: require staff role + created_by self
DROP POLICY IF EXISTS "comm insert staff" ON public.client_communications;
CREATE POLICY "comm insert staff"
ON public.client_communications FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
  )
);
