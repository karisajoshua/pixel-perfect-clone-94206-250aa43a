-- ============ TABLES ============
CREATE TABLE public.automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  client_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_events_unprocessed_idx ON public.automation_events (occurred_at) WHERE processed_at IS NULL;
CREATE INDEX automation_events_tenant_idx ON public.automation_events (tenant_id, occurred_at DESC);
CREATE INDEX automation_events_entity_idx ON public.automation_events (entity_type, entity_id);
GRANT SELECT ON public.automation_events TO authenticated;
GRANT ALL ON public.automation_events TO service_role;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_events tenant read" ON public.automation_events FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,                                  -- NULL = platform-owned template
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  current_version_id uuid,
  is_template boolean NOT NULL DEFAULT false,
  template_key text,
  source_template_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflows_tenant_status_idx ON public.workflows (tenant_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflows read" ON public.workflows FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)));
CREATE POLICY "workflows manage admin manager" ON public.workflows FOR ALL TO authenticated
  USING (public.is_super_admin() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))))
  WITH CHECK (public.is_super_admin() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))));
CREATE TRIGGER workflows_set_tenant BEFORE INSERT ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_tenant();
CREATE TRIGGER workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  tenant_id uuid,
  version_no integer NOT NULL,
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  trigger jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, version_no)
);
ALTER TABLE public.workflows ADD CONSTRAINT workflows_current_version_fk FOREIGN KEY (current_version_id) REFERENCES public.workflow_versions(id) ON DELETE SET NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_versions TO authenticated;
GRANT ALL ON public.workflow_versions TO service_role;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_versions read" ON public.workflow_versions FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)));
CREATE POLICY "workflow_versions manage" ON public.workflow_versions FOR ALL TO authenticated
  USING (public.is_super_admin() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))))
  WITH CHECK (public.is_super_admin() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))));

-- Published versions are immutable
CREATE OR REPLACE FUNCTION public.workflow_versions_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published workflow versions cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published workflow versions are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workflow_versions_immutable_tg BEFORE UPDATE OR DELETE ON public.workflow_versions FOR EACH ROW EXECUTE FUNCTION public.workflow_versions_immutable();

CREATE TABLE public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.workflow_versions(id),
  event_id uuid REFERENCES public.automation_events(id) ON DELETE SET NULL,
  client_id uuid,
  entity_type text,
  entity_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','waiting','completed','failed','cancelled')),
  current_node_id text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_run_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workflow_runs_event_workflow_uidx ON public.workflow_runs (event_id, workflow_id) WHERE event_id IS NOT NULL;
CREATE INDEX workflow_runs_tenant_idx ON public.workflow_runs (tenant_id, created_at DESC);
CREATE INDEX workflow_runs_workflow_idx ON public.workflow_runs (workflow_id, created_at DESC);
GRANT SELECT ON public.workflow_runs TO authenticated;
GRANT ALL ON public.workflow_runs TO service_role;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_runs tenant read" ON public.workflow_runs FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));
CREATE TRIGGER workflow_runs_updated_at BEFORE UPDATE ON public.workflow_runs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.workflow_step_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  node_type text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','skipped','waiting')),
  input jsonb,
  output jsonb,
  error text,
  idempotency_key text NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX workflow_step_executions_run_idx ON public.workflow_step_executions (run_id, started_at);
GRANT SELECT ON public.workflow_step_executions TO authenticated;
GRANT ALL ON public.workflow_step_executions TO service_role;
ALTER TABLE public.workflow_step_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_step_executions tenant read" ON public.workflow_step_executions FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE public.automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  lock_token uuid,
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','cancelled')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Only one open job per run at a time
CREATE UNIQUE INDEX automation_jobs_open_run_uidx ON public.automation_jobs (run_id) WHERE status IN ('pending','running');
CREATE INDEX automation_jobs_due_idx ON public.automation_jobs (run_at) WHERE status = 'pending';
GRANT SELECT ON public.automation_jobs TO authenticated;
GRANT ALL ON public.automation_jobs TO service_role;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_jobs tenant read" ON public.automation_jobs FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));
CREATE TRIGGER automation_jobs_updated_at BEFORE UPDATE ON public.automation_jobs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ EVENT EMITTER ============
CREATE OR REPLACE FUNCTION public.automation_emit_event(
  p_tenant_id uuid, p_event_type text, p_entity_type text, p_entity_id uuid,
  p_client_id uuid DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb, p_dedupe_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.automation_events (tenant_id, event_type, entity_type, entity_id, client_id, payload, dedupe_key)
  VALUES (p_tenant_id, p_event_type, p_entity_type, p_entity_id, p_client_id, coalesce(p_payload,'{}'::jsonb), p_dedupe_key)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.automation_emit_event(uuid,text,text,uuid,uuid,jsonb,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_emit_event(uuid,text,text,uuid,uuid,jsonb,text) TO service_role;

-- ============ TRIGGERS (row-level, never call HTTP) ============
CREATE OR REPLACE FUNCTION public.automation_tg_policies() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM automation_emit_event(NEW.tenant_id, 'policy.created', 'policy', NEW.id, NEW.client_id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM automation_emit_event(NEW.tenant_id, 'policy.updated', 'policy', NEW.id, NEW.client_id,
      to_jsonb(NEW) || jsonb_build_object('previous', jsonb_build_object('status', OLD.status, 'payment_status', OLD.payment_status, 'end_date', OLD.end_date, 'balance_due', OLD.balance_due)));
    IF NEW.status = 'expired' AND OLD.status IS DISTINCT FROM 'expired' THEN
      PERFORM automation_emit_event(NEW.tenant_id, 'policy.expired', 'policy', NEW.id, NEW.client_id, to_jsonb(NEW), 'policy.expired:' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER automation_policies_events AFTER INSERT OR UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.automation_tg_policies();

CREATE OR REPLACE FUNCTION public.automation_tg_payments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client uuid; v_policy uuid; v_tenant uuid;
BEGIN
  SELECT client_id, policy_id, tenant_id INTO v_client, v_policy, v_tenant FROM public.invoices WHERE id = NEW.invoice_id;
  PERFORM automation_emit_event(coalesce(NEW.tenant_id, v_tenant), 'payment.received', 'payment', NEW.id, v_client,
    to_jsonb(NEW) || jsonb_build_object('policy_id', v_policy));
  RETURN NEW;
END $$;
CREATE TRIGGER automation_payments_events AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.automation_tg_payments();

CREATE OR REPLACE FUNCTION public.automation_tg_invoices() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM automation_emit_event(NEW.tenant_id, 'invoice.issued', 'invoice', NEW.id, NEW.client_id, to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER automation_invoices_events AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.automation_tg_invoices();

CREATE OR REPLACE FUNCTION public.automation_tg_claims() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM automation_emit_event(NEW.tenant_id, 'claim.created', 'claim', NEW.id, NEW.client_id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM automation_emit_event(NEW.tenant_id, 'claim.status_changed', 'claim', NEW.id, NEW.client_id,
      to_jsonb(NEW) || jsonb_build_object('previous_status', OLD.status));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER automation_claims_events AFTER INSERT OR UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.automation_tg_claims();

CREATE OR REPLACE FUNCTION public.automation_tg_quotations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM automation_emit_event(NEW.tenant_id, 'quotation.created', 'quotation', NEW.id, NEW.client_id, to_jsonb(NEW) - 'line_items' - 'ipen_quote_payload');
  ELSIF TG_OP = 'UPDATE' AND (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved') THEN
    PERFORM automation_emit_event(NEW.tenant_id, 'quotation.approved', 'quotation', NEW.id, NEW.client_id, to_jsonb(NEW) - 'line_items' - 'ipen_quote_payload');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER automation_quotations_events AFTER INSERT OR UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.automation_tg_quotations();

CREATE OR REPLACE FUNCTION public.automation_tg_clients() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM automation_emit_event(NEW.tenant_id, 'client.created', 'client', NEW.id, NEW.id, to_jsonb(NEW));
  ELSE
    PERFORM automation_emit_event(NEW.tenant_id, 'client.updated', 'client', NEW.id, NEW.id, to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER automation_clients_events AFTER INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.automation_tg_clients();

CREATE OR REPLACE FUNCTION public.automation_tg_required_documents() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'rejected' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'rejected') THEN
    PERFORM automation_emit_event(NEW.tenant_id, 'document.rejected', 'client_required_document', NEW.id, NEW.client_id, to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER automation_required_documents_events AFTER INSERT OR UPDATE ON public.client_required_documents FOR EACH ROW EXECUTE FUNCTION public.automation_tg_required_documents();

-- ============ SCHEDULED (time-based) EVENTS — called by the tick, deduped ============
CREATE OR REPLACE FUNCTION public.automation_scan_scheduled_events(p_limit integer DEFAULT 200)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0; d integer; v_today date := (now() AT TIME ZONE 'Africa/Nairobi')::date;
BEGIN
  -- policy.expiring at 30/14/7/1 days
  FOREACH d IN ARRAY ARRAY[30,14,7,1] LOOP
    FOR r IN SELECT * FROM public.policies WHERE end_date = v_today + d AND status IN ('active','pending') LIMIT p_limit LOOP
      IF automation_emit_event(r.tenant_id, 'policy.expiring', 'policy', r.id, r.client_id,
           to_jsonb(r) || jsonb_build_object('days_to_expiry', d), 'policy.expiring:' || r.id || ':' || d) IS NOT NULL THEN n := n + 1; END IF;
    END LOOP;
  END LOOP;
  -- policy.expired (date passed, still marked active)
  FOR r IN SELECT * FROM public.policies WHERE end_date < v_today AND status = 'active' AND end_date >= v_today - 30 LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'policy.expired', 'policy', r.id, r.client_id, to_jsonb(r), 'policy.expired:' || r.id) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;
  -- invoice.overdue
  FOR r IN SELECT * FROM public.invoices WHERE due_date < v_today AND status <> 'paid' AND due_date >= v_today - 60 LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'invoice.overdue', 'invoice', r.id, r.client_id, to_jsonb(r), 'invoice.overdue:' || r.id) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;
  -- quotation.not_converted
  FOR r IN SELECT * FROM public.quotations WHERE valid_until < v_today AND converted_policy_id IS NULL AND status <> 'converted' AND valid_until >= v_today - 30 LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'quotation.not_converted', 'quotation', r.id, r.client_id, to_jsonb(r) - 'line_items' - 'ipen_quote_payload', 'quotation.not_converted:' || r.id) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;
  -- vehicle.inspection_due (within 14 days)
  FOR r IN SELECT v.*, coalesce(v.next_inspection_date, v.inspection_due) AS due FROM public.vehicles v
           WHERE coalesce(v.next_inspection_date, v.inspection_due) BETWEEN v_today AND v_today + 14 AND coalesce(v.active, true) LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'vehicle.inspection_due', 'vehicle', r.id, r.client_id, to_jsonb(r), 'vehicle.inspection_due:' || r.id || ':' || r.due) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;
  -- document.expiring (within 30 days)
  FOR r IN SELECT * FROM public.client_required_documents WHERE expires_at BETWEEN v_today AND v_today + 30 AND status = 'verified' LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'document.expiring', 'client_required_document', r.id, r.client_id, to_jsonb(r), 'document.expiring:' || r.id || ':' || r.expires_at) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.automation_scan_scheduled_events(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_scan_scheduled_events(integer) TO service_role;

-- ============ CLAIMING (safe for concurrent ticks) ============
CREATE OR REPLACE FUNCTION public.automation_claim_events(p_limit integer DEFAULT 25)
RETURNS SETOF public.automation_events LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.automation_events e
  SET locked_at = now(), processing_attempts = processing_attempts + 1
  WHERE e.id IN (
    SELECT id FROM public.automation_events
    WHERE processed_at IS NULL AND processing_attempts < 5
      AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
    ORDER BY occurred_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING e.*;
$$;
REVOKE ALL ON FUNCTION public.automation_claim_events(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_claim_events(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.automation_claim_jobs(p_limit integer DEFAULT 25)
RETURNS SETOF public.automation_jobs LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.automation_jobs j
  SET locked_at = now(), lock_token = gen_random_uuid(), status = 'running', attempts = attempts + 1
  WHERE j.id IN (
    SELECT id FROM public.automation_jobs
    WHERE (status = 'pending' AND run_at <= now())
       OR (status = 'running' AND locked_at < now() - interval '10 minutes')
    ORDER BY run_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING j.*;
$$;
REVOKE ALL ON FUNCTION public.automation_claim_jobs(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_claim_jobs(integer) TO service_role;