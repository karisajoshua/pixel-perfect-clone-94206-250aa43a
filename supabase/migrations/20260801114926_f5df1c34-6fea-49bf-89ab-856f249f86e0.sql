ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS certificate_no text;
CREATE INDEX IF NOT EXISTS policies_tenant_certificate_no_idx ON public.policies (tenant_id, certificate_no);