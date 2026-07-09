CREATE TABLE IF NOT EXISTS public.ipen_agency_credentials (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  connected_by uuid,
  ipen_email text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  mfa_token text,
  mfa_required boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ipen_agency_credentials TO service_role;

ALTER TABLE public.ipen_agency_credentials ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_ipen_agency_credentials_updated_at ON public.ipen_agency_credentials;
CREATE TRIGGER trg_ipen_agency_credentials_updated_at
BEFORE UPDATE ON public.ipen_agency_credentials
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.ipen_agency_credentials (
  tenant_id,
  connected_by,
  ipen_email,
  access_token,
  refresh_token,
  token_expires_at,
  mfa_token,
  mfa_required,
  last_login_at,
  created_at,
  updated_at
)
SELECT DISTINCT ON (tm.tenant_id)
  tm.tenant_id,
  ic.user_id,
  ic.ipen_email,
  ic.access_token,
  ic.refresh_token,
  ic.token_expires_at,
  ic.mfa_token,
  ic.mfa_required,
  ic.last_login_at,
  ic.created_at,
  ic.updated_at
FROM public.ipen_credentials ic
JOIN public.tenant_members tm ON tm.user_id = ic.user_id
WHERE tm.tenant_id IS NOT NULL
ORDER BY tm.tenant_id, ic.last_login_at DESC NULLS LAST, ic.updated_at DESC
ON CONFLICT (tenant_id) DO UPDATE SET
  connected_by = EXCLUDED.connected_by,
  ipen_email = EXCLUDED.ipen_email,
  access_token = EXCLUDED.access_token,
  refresh_token = EXCLUDED.refresh_token,
  token_expires_at = EXCLUDED.token_expires_at,
  mfa_token = EXCLUDED.mfa_token,
  mfa_required = EXCLUDED.mfa_required,
  last_login_at = EXCLUDED.last_login_at,
  updated_at = now();