DROP POLICY IF EXISTS "Backend can manage agency IPEN credentials" ON public.ipen_agency_credentials;
CREATE POLICY "Backend can manage agency IPEN credentials"
ON public.ipen_agency_credentials
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);