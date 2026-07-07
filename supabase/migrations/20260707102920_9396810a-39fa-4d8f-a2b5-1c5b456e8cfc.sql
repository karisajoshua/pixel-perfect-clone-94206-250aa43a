ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS policies_cancelled_at_idx ON public.policies (cancelled_at);