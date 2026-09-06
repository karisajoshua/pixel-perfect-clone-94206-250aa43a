REVOKE ALL ON FUNCTION public.automation_tg_policies() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_tg_payments() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_tg_invoices() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_tg_claims() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_tg_quotations() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_tg_clients() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_tg_required_documents() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.workflow_versions_immutable() FROM public, anon, authenticated;