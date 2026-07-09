
-- 1) Guard sensitive columns on public.clients against self-update by portal clients.
CREATE OR REPLACE FUNCTION public.clients_block_self_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Non-staff (portal client) path: block changes to privileged fields.
  IF NEW.kyc_status       IS DISTINCT FROM OLD.kyc_status       THEN RAISE EXCEPTION 'You cannot change KYC status.'       USING ERRCODE = '42501'; END IF;
  IF NEW.assigned_agent   IS DISTINCT FROM OLD.assigned_agent   THEN RAISE EXCEPTION 'You cannot change assigned agent.'    USING ERRCODE = '42501'; END IF;
  IF NEW.branch_id        IS DISTINCT FROM OLD.branch_id        THEN RAISE EXCEPTION 'You cannot change branch.'             USING ERRCODE = '42501'; END IF;
  IF NEW.tenant_id        IS DISTINCT FROM OLD.tenant_id        THEN RAISE EXCEPTION 'You cannot change tenant.'             USING ERRCODE = '42501'; END IF;
  IF NEW.auth_user_id     IS DISTINCT FROM OLD.auth_user_id     THEN RAISE EXCEPTION 'You cannot change account linkage.'   USING ERRCODE = '42501'; END IF;
  IF NEW.client_type      IS DISTINCT FROM OLD.client_type      THEN RAISE EXCEPTION 'You cannot change client type.'        USING ERRCODE = '42501'; END IF;
  IF NEW.notes            IS DISTINCT FROM OLD.notes            THEN RAISE EXCEPTION 'You cannot change internal notes.'    USING ERRCODE = '42501'; END IF;
  IF NEW.tags             IS DISTINCT FROM OLD.tags             THEN RAISE EXCEPTION 'You cannot change tags.'               USING ERRCODE = '42501'; END IF;
  IF NEW.source           IS DISTINCT FROM OLD.source           THEN RAISE EXCEPTION 'You cannot change source.'             USING ERRCODE = '42501'; END IF;
  IF NEW.id_number        IS DISTINCT FROM OLD.id_number        THEN RAISE EXCEPTION 'ID number can only be changed by staff.' USING ERRCODE = '42501'; END IF;
  IF NEW.kra_pin          IS DISTINCT FROM OLD.kra_pin          THEN RAISE EXCEPTION 'KRA PIN can only be changed by staff.'   USING ERRCODE = '42501'; END IF;
  IF NEW.dob              IS DISTINCT FROM OLD.dob              THEN RAISE EXCEPTION 'Date of birth can only be changed by staff.' USING ERRCODE = '42501'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_block_self_privilege_changes ON public.clients;
CREATE TRIGGER trg_clients_block_self_privilege_changes
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_block_self_privilege_changes();


-- 2) Restrict client_required_documents self-policy to INSERT + SELECT of own docs
DROP POLICY IF EXISTS "Client manages own kyc docs" ON public.client_required_documents;

CREATE POLICY "Client views own kyc docs"
ON public.client_required_documents
FOR SELECT
TO authenticated
USING (client_id = public.current_client_id());

CREATE POLICY "Client uploads own kyc docs"
ON public.client_required_documents
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = public.current_client_id()
  AND (status IS NULL OR status = 'pending')
  AND verified_by IS NULL
  AND verified_at IS NULL
  AND rejection_reason IS NULL
);
