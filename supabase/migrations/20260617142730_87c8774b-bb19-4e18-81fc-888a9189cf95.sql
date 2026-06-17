
DROP POLICY IF EXISTS "Staff read policies in branch" ON public.policies;
CREATE POLICY "Staff read policies in branch" ON public.policies FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)
  OR ((has_role(auth.uid(),'agent'::app_role) OR has_role(auth.uid(),'viewer'::app_role))
      AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
);

DROP POLICY IF EXISTS "Staff read quotations in branch" ON public.quotations;
CREATE POLICY "Staff read quotations in branch" ON public.quotations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)
  OR ((has_role(auth.uid(),'agent'::app_role) OR has_role(auth.uid(),'viewer'::app_role))
      AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
);

DROP POLICY IF EXISTS "Staff read invoices in branch" ON public.invoices;
CREATE POLICY "Staff read invoices in branch" ON public.invoices FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)
  OR ((has_role(auth.uid(),'agent'::app_role) OR has_role(auth.uid(),'viewer'::app_role))
      AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
);

DROP POLICY IF EXISTS "Staff read claims in branch" ON public.claims;
CREATE POLICY "Staff read claims in branch" ON public.claims FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)
  OR ((has_role(auth.uid(),'agent'::app_role) OR has_role(auth.uid(),'viewer'::app_role))
      AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
);
