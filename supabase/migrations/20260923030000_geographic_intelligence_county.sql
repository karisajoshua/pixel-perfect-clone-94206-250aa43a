-- Geographic intelligence: canonical county assignment for client/risk aggregation.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS county text;

CREATE INDEX IF NOT EXISTS clients_tenant_county_idx
  ON public.clients (tenant_id, county)
  WHERE county IS NOT NULL;

COMMENT ON COLUMN public.clients.county IS
  'Canonical Kenya county name used for tenant-scoped geographic insurance analytics.';
