CREATE OR REPLACE FUNCTION public.prevent_duplicate_client_ids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id  text := NULLIF(btrim(NEW.id_number), '');
  new_pin text := NULLIF(upper(btrim(NEW.kra_pin)), '');
  old_id  text;
  old_pin text;
  clash_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_id  := NULLIF(btrim(OLD.id_number), '');
    old_pin := NULLIF(upper(btrim(OLD.kra_pin)), '');
  END IF;

  IF new_id IS NOT NULL AND (TG_OP = 'INSERT' OR new_id IS DISTINCT FROM old_id) THEN
    SELECT id INTO clash_id
    FROM public.clients
    WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id
      AND NULLIF(btrim(id_number), '') = new_id
    LIMIT 1;
    IF clash_id IS NOT NULL THEN
      RAISE EXCEPTION 'Another client is already registered with ID number %', new_id
        USING ERRCODE = '23505';
    END IF;
  END IF;

  IF new_pin IS NOT NULL AND (TG_OP = 'INSERT' OR new_pin IS DISTINCT FROM old_pin) THEN
    SELECT id INTO clash_id
    FROM public.clients
    WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id
      AND NULLIF(upper(btrim(kra_pin)), '') = new_pin
    LIMIT 1;
    IF clash_id IS NOT NULL THEN
      RAISE EXCEPTION 'Another client is already registered with KRA PIN %', new_pin
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_prevent_duplicate_ids ON public.clients;
CREATE TRIGGER clients_prevent_duplicate_ids
BEFORE INSERT OR UPDATE OF id_number, kra_pin, tenant_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_client_ids();