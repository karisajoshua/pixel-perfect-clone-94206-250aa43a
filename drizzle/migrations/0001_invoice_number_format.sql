ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS invoice_code text,
  ADD COLUMN IF NOT EXISTS invoice_seq integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tenant_invoice_code(_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(upper(regexp_replace(COALESCE(t.invoice_code, ''), '[^A-Za-z0-9]', '', 'g')), ''),
    NULLIF(upper(substring(regexp_replace(COALESCE(t.name, 'AGENCY'), '[^A-Za-z]', '', 'g') from 1 for 3)), ''),
    'AGY'
  )
  FROM public.tenants t
  WHERE t.id = _tenant_id
$$;

CREATE OR REPLACE FUNCTION public.next_invoice_no(_tenant_id uuid, _issue_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
  v_code text;
BEGIN
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required to generate an invoice number';
  END IF;

  UPDATE public.tenants
     SET invoice_seq = invoice_seq + 1
   WHERE id = _tenant_id
  RETURNING invoice_seq INTO v_seq;

  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'Unknown tenant %', _tenant_id;
  END IF;

  v_code := public.tenant_invoice_code(_tenant_id);

  RETURN 'INV' || to_char(COALESCE(_issue_date, CURRENT_DATE), 'YYYYMM') || v_code || lpad(v_seq::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_invoice_code(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_invoice_no(uuid, date) TO authenticated, service_role;