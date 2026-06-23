
DROP POLICY IF EXISTS "Staff read service requests in branch" ON public.service_requests;
CREATE POLICY "Staff read service requests in branch" ON public.service_requests
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (
    has_role(auth.uid(), 'agent'::app_role)
    AND (branch_id IS NULL OR branch_id = user_branch(auth.uid()))
  )
);
