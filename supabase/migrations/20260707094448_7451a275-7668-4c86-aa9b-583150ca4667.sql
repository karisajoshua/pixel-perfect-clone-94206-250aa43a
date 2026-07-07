DROP POLICY IF EXISTS "clients read scope" ON public.clients;
CREATE POLICY "clients read scope" ON public.clients FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (has_role(auth.uid(), 'viewer'::app_role) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
  OR (has_role(auth.uid(), 'agent'::app_role) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid()) OR assigned_agent = auth.uid()))
);