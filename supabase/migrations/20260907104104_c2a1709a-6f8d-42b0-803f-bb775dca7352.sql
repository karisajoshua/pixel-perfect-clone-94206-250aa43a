CREATE OR REPLACE FUNCTION public.automation_scan_scheduled_events(p_limit integer DEFAULT 200)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r record; n integer := 0; d integer;
  v_today date := (now() AT TIME ZONE 'Africa/Nairobi')::date;
  v_offsets integer[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT s.o), ARRAY[]::integer[])
    INTO v_offsets
    FROM public.workflows w
    JOIN public.workflow_versions v ON v.id = w.current_version_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      coalesce(v.trigger->'relative_date'->'offsets', '[]'::jsonb)) AS t(o_txt)
    CROSS JOIN LATERAL (SELECT (t.o_txt)::integer AS o) s
   WHERE w.status = 'active'
     AND v.trigger->>'event_type' = 'policy.expiring';

  SELECT array_agg(DISTINCT x) INTO v_offsets
    FROM unnest(v_offsets || ARRAY[60,30,14,7,1]) x;

  FOREACH d IN ARRAY v_offsets LOOP
    FOR r IN SELECT * FROM public.policies WHERE end_date = v_today + d AND status IN ('active','pending') LIMIT p_limit LOOP
      IF automation_emit_event(r.tenant_id, 'policy.expiring', 'policy', r.id, r.client_id,
           to_jsonb(r) || jsonb_build_object('days_to_expiry', d, 'business_date', v_today, 'business_timezone', 'Africa/Nairobi'),
           'policy.expiring:' || r.id || ':' || d) IS NOT NULL THEN n := n + 1; END IF;
    END LOOP;
  END LOOP;

  FOR r IN SELECT * FROM public.policies WHERE end_date < v_today AND status = 'active' AND end_date >= v_today - 30 LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'policy.expired', 'policy', r.id, r.client_id, to_jsonb(r), 'policy.expired:' || r.id) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.invoices WHERE due_date < v_today AND status <> 'paid' AND due_date >= v_today - 60 LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'invoice.overdue', 'invoice', r.id, r.client_id, to_jsonb(r), 'invoice.overdue:' || r.id) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.quotations WHERE valid_until < v_today AND converted_policy_id IS NULL AND status <> 'converted' AND valid_until >= v_today - 30 LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'quotation.not_converted', 'quotation', r.id, r.client_id, to_jsonb(r) - 'line_items' - 'ipen_quote_payload', 'quotation.not_converted:' || r.id) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;

  FOR r IN SELECT v.*, coalesce(v.next_inspection_date, v.inspection_due) AS due FROM public.vehicles v
           WHERE coalesce(v.next_inspection_date, v.inspection_due) BETWEEN v_today AND v_today + 14 AND coalesce(v.active, true) LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'vehicle.inspection_due', 'vehicle', r.id, r.client_id, to_jsonb(r), 'vehicle.inspection_due:' || r.id || ':' || r.due) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.client_required_documents WHERE expires_at BETWEEN v_today AND v_today + 30 AND status = 'verified' LIMIT p_limit LOOP
    IF automation_emit_event(r.tenant_id, 'document.expiring', 'client_required_document', r.id, r.client_id, to_jsonb(r), 'document.expiring:' || r.id || ':' || r.expires_at) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;

  RETURN n;
END
$fn$;