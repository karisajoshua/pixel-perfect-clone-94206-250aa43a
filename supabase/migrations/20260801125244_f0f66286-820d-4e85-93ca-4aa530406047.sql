CREATE OR REPLACE FUNCTION public.clients_block_self_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_staff boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  is_staff := public.has_role(uid, 'admin'::app_role)
           OR public.has_role(uid, 'manager'::app_role)
           OR public.has_role(uid, 'agent'::app_role)
           OR public.is_super_admin(uid);

  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.kyc_status              IS DISTINCT FROM OLD.kyc_status              THEN RAISE EXCEPTION 'You cannot change KYC status.' USING ERRCODE = '42501'; END IF;
  IF NEW.kra_verification_status IS DISTINCT FROM OLD.kra_verification_status THEN RAISE EXCEPTION 'You cannot change KRA verification status.' USING ERRCODE = '42501'; END IF;
  IF NEW.kra_verified_name       IS DISTINCT FROM OLD.kra_verified_name       THEN RAISE EXCEPTION 'You cannot change KRA verification details.' USING ERRCODE = '42501'; END IF;
  IF NEW.kra_verified_at         IS DISTINCT FROM OLD.kra_verified_at         THEN RAISE EXCEPTION 'You cannot change KRA verification details.' USING ERRCODE = '42501'; END IF;
  IF NEW.kra_id_type             IS DISTINCT FROM OLD.kra_id_type             THEN RAISE EXCEPTION 'You cannot change KRA identification type.' USING ERRCODE = '42501'; END IF;
  IF NEW.assigned_agent          IS DISTINCT FROM OLD.assigned_agent          THEN RAISE EXCEPTION 'You cannot change assigned agent.' USING ERRCODE = '42501'; END IF;
  IF NEW.branch_id               IS DISTINCT FROM OLD.branch_id               THEN RAISE EXCEPTION 'You cannot change branch.' USING ERRCODE = '42501'; END IF;
  IF NEW.tenant_id               IS DISTINCT FROM OLD.tenant_id               THEN RAISE EXCEPTION 'You cannot change agency.' USING ERRCODE = '42501'; END IF;
  IF NEW.auth_user_id            IS DISTINCT FROM OLD.auth_user_id            THEN RAISE EXCEPTION 'You cannot change account linkage.' USING ERRCODE = '42501'; END IF;
  IF NEW.created_by              IS DISTINCT FROM OLD.created_by              THEN RAISE EXCEPTION 'You cannot change record ownership.' USING ERRCODE = '42501'; END IF;
  IF NEW.client_type             IS DISTINCT FROM OLD.client_type             THEN RAISE EXCEPTION 'You cannot change client type.' USING ERRCODE = '42501'; END IF;
  IF NEW.notes                   IS DISTINCT FROM OLD.notes                   THEN RAISE EXCEPTION 'You cannot change internal notes.' USING ERRCODE = '42501'; END IF;
  IF NEW.tags                    IS DISTINCT FROM OLD.tags                    THEN RAISE EXCEPTION 'You cannot change tags.' USING ERRCODE = '42501'; END IF;
  IF NEW.source                  IS DISTINCT FROM OLD.source                  THEN RAISE EXCEPTION 'You cannot change source.' USING ERRCODE = '42501'; END IF;
  IF NEW.id_number               IS DISTINCT FROM OLD.id_number               THEN RAISE EXCEPTION 'ID number can only be changed by staff.' USING ERRCODE = '42501'; END IF;
  IF NEW.kra_pin                 IS DISTINCT FROM OLD.kra_pin                 THEN RAISE EXCEPTION 'KRA PIN can only be changed by staff.' USING ERRCODE = '42501'; END IF;
  IF NEW.date_of_birth           IS DISTINCT FROM OLD.date_of_birth           THEN RAISE EXCEPTION 'Date of birth can only be changed by staff.' USING ERRCODE = '42501'; END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS clients_block_self_privilege_changes ON public.clients;
CREATE TRIGGER clients_block_self_privilege_changes
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_block_self_privilege_changes();