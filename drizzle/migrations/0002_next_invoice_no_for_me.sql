CREATE OR REPLACE FUNCTION public.next_invoice_no_for_me(_issue_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No agency for current user';
  END IF;
  RETURN public.next_invoice_no(v_tenant, _issue_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_no_for_me(date) TO authenticated, service_role;