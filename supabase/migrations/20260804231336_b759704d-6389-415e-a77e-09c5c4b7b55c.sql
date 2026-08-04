ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS signatory_name text,
  ADD COLUMN IF NOT EXISTS signatory_title text;

UPDATE public.tenants
SET signatory_name = 'Elizabeth Grace'
WHERE signatory_name IS NULL
  AND name ILIKE '%zest%';