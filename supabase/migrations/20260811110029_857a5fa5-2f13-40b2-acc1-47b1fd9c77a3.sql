ALTER TABLE public.policies DROP CONSTRAINT IF EXISTS policies_policy_term_check;
ALTER TABLE public.policies ADD CONSTRAINT policies_policy_term_check
  CHECK (policy_term IS NULL OR policy_term IN ('tor','one_month_extendable','second_installment','rop','six_months','annual'));

ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_policy_term_check;
ALTER TABLE public.quotations ADD CONSTRAINT quotations_policy_term_check
  CHECK (policy_term IS NULL OR policy_term IN ('tor','one_month_extendable','second_installment','rop','six_months','annual'));