
CREATE OR REPLACE FUNCTION public.enforce_creator_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
  ub uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.has_role(uid, 'admin'::app_role) INTO is_admin;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  ub := public.user_branch(uid);
  IF ub IS NULL THEN
    RAISE EXCEPTION 'Your account is not assigned to a branch. Ask an admin to assign you to a branch before creating records.';
  END IF;

  NEW.branch_id := ub;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_branch_clients ON public.clients;
CREATE TRIGGER trg_enforce_branch_clients
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_branch();

DROP TRIGGER IF EXISTS trg_enforce_branch_policies ON public.policies;
CREATE TRIGGER trg_enforce_branch_policies
  BEFORE INSERT ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_branch();

DROP TRIGGER IF EXISTS trg_enforce_branch_claims ON public.claims;
CREATE TRIGGER trg_enforce_branch_claims
  BEFORE INSERT ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_branch();

DROP TRIGGER IF EXISTS trg_enforce_branch_invoices ON public.invoices;
CREATE TRIGGER trg_enforce_branch_invoices
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_branch();

DROP TRIGGER IF EXISTS trg_enforce_branch_quotations ON public.quotations;
CREATE TRIGGER trg_enforce_branch_quotations
  BEFORE INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_branch();

DROP TRIGGER IF EXISTS trg_enforce_branch_service_requests ON public.service_requests;
CREATE TRIGGER trg_enforce_branch_service_requests
  BEFORE INSERT ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_branch();
