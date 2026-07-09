
-- Add policy_term to quotations and policies
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS policy_term text;
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS policy_term text;
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS balance_due numeric;

DO $$ BEGIN
  ALTER TABLE public.quotations ADD CONSTRAINT quotations_policy_term_check
    CHECK (policy_term IS NULL OR policy_term IN ('tor','one_month_extendable','six_months','annual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.policies ADD CONSTRAINT policies_policy_term_check
    CHECK (policy_term IS NULL OR policy_term IN ('tor','one_month_extendable','six_months','annual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payment extensions table
CREATE TABLE IF NOT EXISTS public.policy_payment_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  tenant_id uuid,
  branch_id uuid,
  amount_due numeric NOT NULL,
  due_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_payment_extensions TO authenticated;
GRANT ALL ON public.policy_payment_extensions TO service_role;

ALTER TABLE public.policy_payment_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppe tenant read" ON public.policy_payment_extensions
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "ppe write" ON public.policy_payment_extensions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "ppe update" ON public.policy_payment_extensions
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_tenant_member(tenant_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "ppe delete" ON public.policy_payment_extensions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER ppe_set_tenant BEFORE INSERT ON public.policy_payment_extensions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_tenant();

CREATE TRIGGER ppe_set_branch BEFORE INSERT ON public.policy_payment_extensions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_branch();

CREATE TRIGGER ppe_updated_at BEFORE UPDATE ON public.policy_payment_extensions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS ppe_policy_idx ON public.policy_payment_extensions(policy_id);
CREATE INDEX IF NOT EXISTS ppe_tenant_status_idx ON public.policy_payment_extensions(tenant_id, status, due_date);
