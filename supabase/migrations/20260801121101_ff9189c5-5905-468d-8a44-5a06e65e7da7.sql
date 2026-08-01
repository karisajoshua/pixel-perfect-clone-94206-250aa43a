ALTER TABLE public.client_required_documents
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.client_required_documents
  DROP CONSTRAINT IF EXISTS client_required_documents_client_id_doc_type_key;
DROP INDEX IF EXISTS public.client_required_documents_client_id_doc_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS crd_client_doctype_uniq
  ON public.client_required_documents (client_id, doc_type)
  WHERE vehicle_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crd_vehicle_doctype_uniq
  ON public.client_required_documents (vehicle_id, doc_type)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crd_vehicle_id_idx
  ON public.client_required_documents (vehicle_id);