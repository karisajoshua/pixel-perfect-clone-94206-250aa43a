
-- Scope agent write access to their branch on claims, invoices, invoice_items
DROP POLICY IF EXISTS "Staff write claims" ON public.claims;
CREATE POLICY "Staff write claims" ON public.claims
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
    OR (has_role(auth.uid(), 'agent'::app_role) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
    OR (has_role(auth.uid(), 'agent'::app_role) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
  );

DROP POLICY IF EXISTS "Staff write invoices" ON public.invoices;
CREATE POLICY "Staff write invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
    OR (has_role(auth.uid(), 'agent'::app_role) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
    OR (has_role(auth.uid(), 'agent'::app_role) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
  );

DROP POLICY IF EXISTS "invoice items staff write" ON public.invoice_items;
CREATE POLICY "invoice items staff write" ON public.invoice_items
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id AND i.branch_id = user_branch(auth.uid())
    ))
    OR (has_role(auth.uid(), 'agent'::app_role) AND EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.clients c ON c.id = i.client_id
      WHERE i.id = invoice_items.invoice_id
        AND (c.branch_id = user_branch(auth.uid()) OR c.assigned_agent = auth.uid())
    ))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id AND i.branch_id = user_branch(auth.uid())
    ))
    OR (has_role(auth.uid(), 'agent'::app_role) AND EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.clients c ON c.id = i.client_id
      WHERE i.id = invoice_items.invoice_id
        AND (c.branch_id = user_branch(auth.uid()) OR c.assigned_agent = auth.uid())
    ))
  );
