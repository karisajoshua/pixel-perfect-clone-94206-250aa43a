DROP POLICY IF EXISTS "Staff read vehicles in branch" ON public.vehicles;
CREATE POLICY "Staff read vehicles in agency" ON public.vehicles
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'agent'::app_role)
  OR public.has_role(auth.uid(), 'viewer'::app_role)
);

DROP POLICY IF EXISTS "Staff read policies in branch" ON public.policies;
CREATE POLICY "Staff read policies in agency" ON public.policies
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'agent'::app_role)
  OR public.has_role(auth.uid(), 'viewer'::app_role)
);