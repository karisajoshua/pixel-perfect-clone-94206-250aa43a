DROP TRIGGER IF EXISTS branches_set_tenant ON public.branches;
CREATE TRIGGER branches_set_tenant
BEFORE INSERT ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_tenant();