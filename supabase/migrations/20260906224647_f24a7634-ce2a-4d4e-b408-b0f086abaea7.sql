CREATE OR REPLACE FUNCTION public.workflow_versions_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Allow the cascade when the parent workflow itself is being removed.
    IF OLD.published_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.workflows WHERE id = OLD.workflow_id) THEN
      RAISE EXCEPTION 'Published workflow versions cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published workflow versions are immutable'; END IF;
  RETURN NEW;
END $$;