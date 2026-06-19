
-- KYC doc type enum
DO $$ BEGIN
  CREATE TYPE public.kyc_doc_type AS ENUM (
    'id_front','id_back','kra_pin','proof_of_address','passport_photo',
    'cert_incorporation','cr12','director_id'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyc_doc_status AS ENUM ('pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.client_required_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  doc_type public.kyc_doc_type NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  status public.kyc_doc_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  verified_by uuid,
  verified_at timestamptz,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_required_documents TO authenticated;
GRANT ALL ON public.client_required_documents TO service_role;

ALTER TABLE public.client_required_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client manages own kyc docs"
  ON public.client_required_documents FOR ALL TO authenticated
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

CREATE POLICY "Staff reads all kyc docs"
  ON public.client_required_documents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'manager') OR
    public.has_role(auth.uid(),'agent') OR
    public.has_role(auth.uid(),'viewer')
  );

CREATE POLICY "Staff updates kyc docs"
  ON public.client_required_documents FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'manager') OR
    public.has_role(auth.uid(),'agent')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'manager') OR
    public.has_role(auth.uid(),'agent')
  );

CREATE TRIGGER set_client_required_documents_updated_at
  BEFORE UPDATE ON public.client_required_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
