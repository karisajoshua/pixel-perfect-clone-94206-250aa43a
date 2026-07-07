
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS kra_id_type text,
  ADD COLUMN IF NOT EXISTS kra_verified_name text,
  ADD COLUMN IF NOT EXISTS kra_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS kra_verification_status text;
