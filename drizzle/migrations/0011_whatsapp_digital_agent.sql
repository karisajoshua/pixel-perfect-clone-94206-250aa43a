-- WhatsApp digital insurance agent: durable conversation state + OTP challenges.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS bot_state text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS bot_context jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bot_paused boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.whatsapp_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  phone text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('vehicle_access','policy_access','transaction')),
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_verification_active_idx
  ON public.whatsapp_verification_challenges (tenant_id, conversation_id, expires_at DESC);

GRANT SELECT ON public.whatsapp_verification_challenges TO authenticated;
GRANT ALL ON public.whatsapp_verification_challenges TO service_role;
ALTER TABLE public.whatsapp_verification_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "whatsapp verification staff read" ON public.whatsapp_verification_challenges;
CREATE POLICY "whatsapp verification staff read" ON public.whatsapp_verification_challenges
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));