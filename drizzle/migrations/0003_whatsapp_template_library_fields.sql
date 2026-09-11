ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS library_group text,
  ADD COLUMN IF NOT EXISTS meta_status text NOT NULL DEFAULT 'not_submitted';

ALTER TABLE public.whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_meta_status_chk;
ALTER TABLE public.whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_meta_status_chk
  CHECK (meta_status IN ('not_submitted','pending','approved','rejected','disabled'));

UPDATE public.whatsapp_templates
  SET display_name = COALESCE(display_name, initcap(replace(name, '_', ' ')));

CREATE INDEX IF NOT EXISTS whatsapp_templates_group_idx
  ON public.whatsapp_templates (library_group);