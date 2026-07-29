CREATE OR REPLACE FUNCTION public.verify_invoice(_id uuid)
RETURNS TABLE (
  invoice_no text,
  agency_name text,
  client_name text,
  issue_date date,
  due_date date,
  total numeric,
  amount_paid numeric,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.invoice_no,
    COALESCE(t.name, 'Zest Insurance Agency') AS agency_name,
    CASE WHEN c.client_type = 'corporate' THEN COALESCE(c.company_name, c.full_name) ELSE c.full_name END AS client_name,
    i.issue_date,
    i.due_date,
    i.total,
    i.amount_paid,
    i.status
  FROM public.invoices i
  LEFT JOIN public.clients c ON c.id = i.client_id
  LEFT JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.id = _id
$$;

REVOKE ALL ON FUNCTION public.verify_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_invoice(uuid) TO anon, authenticated, service_role;