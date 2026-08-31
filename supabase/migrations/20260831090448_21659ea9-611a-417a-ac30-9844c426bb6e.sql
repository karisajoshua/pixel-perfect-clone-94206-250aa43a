CREATE OR REPLACE FUNCTION public.validate_policy_date_range()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Policy end date cannot be earlier than start date'
      USING ERRCODE = '22007';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_policy_date_range_trigger ON public.policies;
CREATE TRIGGER validate_policy_date_range_trigger
BEFORE INSERT OR UPDATE OF start_date, end_date ON public.policies
FOR EACH ROW
EXECUTE FUNCTION public.validate_policy_date_range();