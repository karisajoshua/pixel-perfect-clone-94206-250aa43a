-- =========================================================
-- Phase 2: WhatsApp communication infrastructure
-- =========================================================

-- ---------- 1. messaging_channels ----------
CREATE TABLE public.messaging_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms')),
  provider text NOT NULL DEFAULT 'meta_cloud',
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  display_name text,
  status text NOT NULL DEFAULT 'not_connected'
    CHECK (status IN ('not_connected','pending','connected','disabled','error')),
  -- Name of the secure secret holding the provider access token. Never the token itself.
  credentials_ref text,
  is_shared boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','production')),
  test_recipients text[] NOT NULL DEFAULT '{}',
  daily_message_limit integer NOT NULL DEFAULT 1000,
  per_minute_limit integer NOT NULL DEFAULT 30,
  last_error text,
  last_verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX messaging_channels_tenant_channel_idx
  ON public.messaging_channels (tenant_id, channel, provider);
CREATE INDEX messaging_channels_phone_number_id_idx
  ON public.messaging_channels (phone_number_id) WHERE phone_number_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_channels TO authenticated;
GRANT ALL ON public.messaging_channels TO service_role;
ALTER TABLE public.messaging_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messaging_channels tenant read" ON public.messaging_channels
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));
CREATE POLICY "messaging_channels admin write" ON public.messaging_channels
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))))
  WITH CHECK (public.is_super_admin() OR (public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))));

-- ---------- 2. whatsapp_templates ----------
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_scope text NOT NULL DEFAULT 'agency' CHECK (owner_scope IN ('platform','agency')),
  name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  category text NOT NULL DEFAULT 'UTILITY' CHECK (category IN ('UTILITY','MARKETING','AUTHENTICATION')),
  header text,
  body text NOT NULL,
  footer text,
  variables jsonb NOT NULL DEFAULT '[]',
  provider_template_name text,
  provider_template_id text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','approved','rejected','disabled')),
  cloned_from uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_templates_scope_chk
    CHECK ((owner_scope = 'platform' AND tenant_id IS NULL) OR (owner_scope = 'agency' AND tenant_id IS NOT NULL))
);
CREATE UNIQUE INDEX whatsapp_templates_unique_name
  ON public.whatsapp_templates (tenant_id, name, language) NULLS NOT DISTINCT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_templates read" ON public.whatsapp_templates
  FOR SELECT TO authenticated
  USING (owner_scope = 'platform' OR public.is_super_admin() OR public.is_tenant_member(tenant_id));
CREATE POLICY "whatsapp_templates agency write" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR (owner_scope = 'agency' AND public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))))
  WITH CHECK (public.is_super_admin() OR (owner_scope = 'agency' AND public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))));

-- ---------- 3. conversations ----------
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  channel_id uuid REFERENCES public.messaging_channels(id) ON DELETE SET NULL,
  external_contact text NOT NULL,
  contact_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','bot','escalated','closed')),
  identification text NOT NULL DEFAULT 'unidentified'
    CHECK (identification IN ('identified','unidentified','ambiguous')),
  assigned_to uuid,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_at timestamptz,
  ai_intent text,
  ai_context jsonb NOT NULL DEFAULT '{}',
  workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX conversations_tenant_contact_idx
  ON public.conversations (tenant_id, channel, external_contact);
CREATE INDEX conversations_client_idx ON public.conversations (client_id);
CREATE INDEX conversations_tenant_recent_idx ON public.conversations (tenant_id, last_message_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations tenant read" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));
CREATE POLICY "conversations staff write" ON public.conversations
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))))
  WITH CHECK (public.is_super_admin() OR (public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))));

-- ---------- 4. conversation_messages ----------
CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text','template','image','document','audio','video','sticker','location','interactive','other')),
  template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  template_name text,
  language text,
  body text,
  variables jsonb NOT NULL DEFAULT '{}',
  media jsonb,
  provider text,
  provider_message_id text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','delivered','read','failed','received','skipped')),
  error text,
  error_code text,
  recipient text,
  sender text,
  workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  workflow_step_id uuid REFERENCES public.workflow_step_executions(id) ON DELETE SET NULL,
  idempotency_key text UNIQUE,
  dry_run boolean NOT NULL DEFAULT false,
  is_test boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}',
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX conversation_messages_provider_msg_idx
  ON public.conversation_messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX conversation_messages_conversation_idx
  ON public.conversation_messages (conversation_id, created_at DESC);
CREATE INDEX conversation_messages_tenant_idx
  ON public.conversation_messages (tenant_id, created_at DESC);
CREATE INDEX conversation_messages_run_idx ON public.conversation_messages (workflow_run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_messages tenant read" ON public.conversation_messages
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));
CREATE POLICY "conversation_messages staff write" ON public.conversation_messages
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))))
  WITH CHECK (public.is_super_admin() OR (public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))));

-- ---------- 5. contact_consents ----------
CREATE TABLE public.contact_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms','email')),
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'opted_in' CHECK (status IN ('opted_in','opted_out')),
  source text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contact_consents_unique
  ON public.contact_consents (tenant_id, channel, phone);
CREATE INDEX contact_consents_client_idx ON public.contact_consents (client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_consents TO authenticated;
GRANT ALL ON public.contact_consents TO service_role;
ALTER TABLE public.contact_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_consents tenant read" ON public.contact_consents
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));
CREATE POLICY "contact_consents staff write" ON public.contact_consents
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))))
  WITH CHECK (public.is_super_admin() OR (public.is_tenant_member(tenant_id)
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))));

-- ---------- 6. whatsapp_webhook_events ----------
CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'meta_cloud',
  event_id text NOT NULL,
  kind text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES public.messaging_channels(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);
CREATE UNIQUE INDEX whatsapp_webhook_events_unique ON public.whatsapp_webhook_events (provider, event_id);
CREATE INDEX whatsapp_webhook_events_recent_idx ON public.whatsapp_webhook_events (received_at DESC);

GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_webhook_events read" ON public.whatsapp_webhook_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)));

-- ---------- 7. messaging_usage (quotas) ----------
CREATE TABLE public.messaging_usage (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Nairobi')::date,
  sent_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, channel, usage_date)
);
GRANT SELECT ON public.messaging_usage TO authenticated;
GRANT ALL ON public.messaging_usage TO service_role;
ALTER TABLE public.messaging_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messaging_usage tenant read" ON public.messaging_usage
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

-- Atomically reserve one message against a tenant's daily quota.
CREATE OR REPLACE FUNCTION public.messaging_consume_quota(
  p_tenant uuid, p_channel text, p_limit integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date := (now() AT TIME ZONE 'Africa/Nairobi')::date;
  v_count integer;
BEGIN
  INSERT INTO public.messaging_usage (tenant_id, channel, usage_date, sent_count)
  VALUES (p_tenant, p_channel, v_date, 1)
  ON CONFLICT (tenant_id, channel, usage_date)
  DO UPDATE SET sent_count = public.messaging_usage.sent_count + 1, updated_at = now()
  RETURNING sent_count INTO v_count;

  IF p_limit IS NOT NULL AND v_count > p_limit THEN
    UPDATE public.messaging_usage
      SET sent_count = sent_count - 1
      WHERE tenant_id = p_tenant AND channel = p_channel AND usage_date = v_date;
    RETURN false;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_consume_quota(uuid, text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_consume_quota(uuid, text, integer) TO service_role;

-- ---------- 8. updated_at triggers ----------
CREATE TRIGGER messaging_channels_updated_at BEFORE UPDATE ON public.messaging_channels
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER whatsapp_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER conversation_messages_updated_at BEFORE UPDATE ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- 9. phone lookup indexes for customer matching ----------
CREATE INDEX IF NOT EXISTS clients_tenant_phone_idx ON public.clients (tenant_id, phone);
CREATE INDEX IF NOT EXISTS clients_tenant_alt_phone_idx ON public.clients (tenant_id, alt_phone);

-- ---------- 10. platform starter templates ----------
INSERT INTO public.whatsapp_templates (tenant_id, owner_scope, name, language, category, body, variables, provider_template_name, status)
VALUES
  (NULL, 'platform', 'renewal_reminder', 'en', 'UTILITY',
   'Hi {{1}}, your {{2}} policy {{3}} expires on {{4}}. Reply RENEW or contact us to renew.',
   '["client_name","product","policy_number","expiry_date"]'::jsonb, 'renewal_reminder', 'draft'),
  (NULL, 'platform', 'payment_received', 'en', 'UTILITY',
   'Hi {{1}}, we have received your payment of KES {{2}} for policy {{3}}. Balance: KES {{4}}. Thank you.',
   '["client_name","amount","policy_number","balance"]'::jsonb, 'payment_received', 'draft'),
  (NULL, 'platform', 'policy_issued', 'en', 'UTILITY',
   'Hi {{1}}, your policy {{2}} is now active from {{3}} to {{4}}. Documents follow shortly.',
   '["client_name","policy_number","start_date","end_date"]'::jsonb, 'policy_issued', 'draft');