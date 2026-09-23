-- Geographic drill-down dimensions for Kenya insurance intelligence.
-- Values are nullable so existing records remain valid until normalized.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS subcounty text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ward text;

CREATE INDEX IF NOT EXISTS clients_tenant_county_subcounty_idx
  ON public.clients (tenant_id, county, subcounty)
  WHERE county IS NOT NULL AND subcounty IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_tenant_county_subcounty_ward_idx
  ON public.clients (tenant_id, county, subcounty, ward)
  WHERE county IS NOT NULL AND subcounty IS NOT NULL AND ward IS NOT NULL;

COMMENT ON COLUMN public.clients.subcounty IS 'Normalized Kenya sub-county/constituency used for tenant-scoped geographic analytics.';
COMMENT ON COLUMN public.clients.ward IS 'Normalized Kenya ward used for tenant-scoped geographic analytics.';
