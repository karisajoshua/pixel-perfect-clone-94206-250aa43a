ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS installment_plan text,
  ADD COLUMN IF NOT EXISTS rop_of_policy_id uuid REFERENCES public.policies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_policies_rop_of_policy_id ON public.policies(rop_of_policy_id);