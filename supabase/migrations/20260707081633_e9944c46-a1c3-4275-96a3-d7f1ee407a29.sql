
-- IPEN integration schema

CREATE TABLE public.ipen_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipen_credentials TO authenticated;
GRANT ALL ON public.ipen_credentials TO service_role;

ALTER TABLE public.ipen_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own credentials read"
  ON public.ipen_credentials FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "own credentials write"
  ON public.ipen_credentials FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own credentials update"
  ON public.ipen_credentials FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own credentials delete"
  ON public.ipen_credentials FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER ipen_credentials_updated_at
  BEFORE UPDATE ON public.ipen_credentials
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Local references to IPEN entities on our existing rows.
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS ipen_proposal_id text,
  ADD COLUMN IF NOT EXISTS ipen_quote_payload jsonb;

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS ipen_policy_id text;

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS ipen_claim_id text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS ipen_transaction_ref text,
  ADD COLUMN IF NOT EXISTS ipen_checkout_request_id text;

CREATE INDEX IF NOT EXISTS payments_ipen_checkout_request_id_idx
  ON public.payments(ipen_checkout_request_id)
  WHERE ipen_checkout_request_id IS NOT NULL;
