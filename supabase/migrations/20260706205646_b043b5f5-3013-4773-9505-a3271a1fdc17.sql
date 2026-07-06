CREATE OR REPLACE FUNCTION public.enforce_creator_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Platform-level users may intentionally provide a tenant_id. If they do not,
  -- fall back to their current agency membership so NOT NULL tenant fields are populated.
  IF public.is_super_admin() AND NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  tid := public.current_tenant_id();
  IF tid IS NULL THEN
    RAISE EXCEPTION 'You are not a member of any agency. Complete onboarding first.';
  END IF;

  NEW.tenant_id := tid;
  RETURN NEW;
END;
$function$;