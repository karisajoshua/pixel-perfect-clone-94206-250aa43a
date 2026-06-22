GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_required_documents TO authenticated;
GRANT ALL ON public.client_required_documents TO service_role;

CREATE POLICY "Staff can add kyc docs"
ON public.client_required_documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'agent')
);