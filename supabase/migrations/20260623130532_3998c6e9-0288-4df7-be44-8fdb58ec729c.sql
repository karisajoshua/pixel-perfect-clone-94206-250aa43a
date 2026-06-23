
-- CLIENTS
DROP POLICY IF EXISTS "clients read scope" ON public.clients;
CREATE POLICY "clients read scope" ON public.clients FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR (has_role(auth.uid(), 'viewer'::app_role) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
  OR (has_role(auth.uid(), 'agent'::app_role) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid()) OR assigned_agent = auth.uid()))
);
DROP POLICY IF EXISTS "clients update staff" ON public.clients;
CREATE POLICY "clients update staff" ON public.clients FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR (has_role(auth.uid(), 'agent'::app_role) AND (branch_id = user_branch(auth.uid()) OR assigned_agent = auth.uid()))
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR (has_role(auth.uid(), 'agent'::app_role) AND (branch_id = user_branch(auth.uid()) OR assigned_agent = auth.uid()))
);
DROP POLICY IF EXISTS "clients insert staff" ON public.clients;
CREATE POLICY "clients insert staff" ON public.clients FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
);

-- POLICIES
DROP POLICY IF EXISTS "Staff read policies in branch" ON public.policies;
CREATE POLICY "Staff read policies in branch" ON public.policies FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR ((has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'viewer'::app_role)) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
);
DROP POLICY IF EXISTS "Staff write policies" ON public.policies;
CREATE POLICY "Staff write policies" ON public.policies FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
);

-- CLAIMS
DROP POLICY IF EXISTS "Staff read claims in branch" ON public.claims;
CREATE POLICY "Staff read claims in branch" ON public.claims FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR ((has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'viewer'::app_role)) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
);
DROP POLICY IF EXISTS "Staff write claims" ON public.claims;
CREATE POLICY "Staff write claims" ON public.claims FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
);

-- INVOICES
DROP POLICY IF EXISTS "Staff read invoices in branch" ON public.invoices;
CREATE POLICY "Staff read invoices in branch" ON public.invoices FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR ((has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'viewer'::app_role)) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
);
DROP POLICY IF EXISTS "Staff write invoices" ON public.invoices;
CREATE POLICY "Staff write invoices" ON public.invoices FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
);

-- QUOTATIONS
DROP POLICY IF EXISTS "Staff read quotations in branch" ON public.quotations;
CREATE POLICY "Staff read quotations in branch" ON public.quotations FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR ((has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'viewer'::app_role)) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
);
DROP POLICY IF EXISTS "Staff write quotations" ON public.quotations;
CREATE POLICY "Staff write quotations" ON public.quotations FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
);

-- VEHICLES (via parent client branch)
DROP POLICY IF EXISTS "Staff read vehicles in branch" ON public.vehicles;
CREATE POLICY "Staff read vehicles in branch" ON public.vehicles FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = vehicles.client_id AND c.branch_id = user_branch(auth.uid())
  ))
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR (has_role(auth.uid(), 'agent'::app_role) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = vehicles.client_id AND (c.branch_id IS NULL OR c.branch_id = user_branch(auth.uid()) OR c.assigned_agent = auth.uid())
  ))
);

-- INVOICE ITEMS (via parent invoice + client branch)
DROP POLICY IF EXISTS "invoice items staff scope" ON public.invoice_items;
CREATE POLICY "invoice items staff scope" ON public.invoice_items FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.branch_id = user_branch(auth.uid())
  ))
  OR (has_role(auth.uid(), 'agent'::app_role) AND EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.clients c ON c.id = i.client_id
    WHERE i.id = invoice_items.invoice_id AND (c.branch_id = user_branch(auth.uid()) OR c.assigned_agent = auth.uid())
  ))
);

-- PAYMENTS (via parent invoice + client branch)
DROP POLICY IF EXISTS "payments staff scope" ON public.payments;
CREATE POLICY "payments staff scope" ON public.payments FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = payments.invoice_id AND i.branch_id = user_branch(auth.uid())
  ))
  OR (has_role(auth.uid(), 'agent'::app_role) AND EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.clients c ON c.id = i.client_id
    WHERE i.id = payments.invoice_id AND (c.branch_id = user_branch(auth.uid()) OR c.assigned_agent = auth.uid())
  ))
);

-- CLIENT_COMMUNICATIONS (via parent client)
DROP POLICY IF EXISTS "comm read staff" ON public.client_communications;
CREATE POLICY "comm read staff" ON public.client_communications FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'viewer'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = client_communications.client_id AND c.branch_id = user_branch(auth.uid())
  ))
  OR EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_communications.client_id
      AND (c.branch_id = user_branch(auth.uid()) OR c.assigned_agent = auth.uid())
  )
);

-- SERVICE_REQUESTS
DROP POLICY IF EXISTS "Staff read service requests in branch" ON public.service_requests;
CREATE POLICY "Staff read service requests in branch" ON public.service_requests FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR (has_role(auth.uid(), 'agent'::app_role) AND (branch_id IS NULL OR branch_id = user_branch(auth.uid())))
);
DROP POLICY IF EXISTS "Staff update service requests" ON public.service_requests;
CREATE POLICY "Staff update service requests" ON public.service_requests FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND branch_id = user_branch(auth.uid()))
  OR has_role(auth.uid(), 'agent'::app_role)
);
