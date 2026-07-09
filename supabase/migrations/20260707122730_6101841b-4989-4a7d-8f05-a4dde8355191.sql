
CREATE INDEX IF NOT EXISTS idx_policies_branch_id ON public.policies(branch_id);
CREATE INDEX IF NOT EXISTS idx_policies_status ON public.policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_end_date ON public.policies(end_date);
CREATE INDEX IF NOT EXISTS idx_policies_client_id ON public.policies(client_id);
CREATE INDEX IF NOT EXISTS idx_policies_insurer_id ON public.policies(insurer_id);
CREATE INDEX IF NOT EXISTS idx_policies_created_by ON public.policies(created_by);

CREATE INDEX IF NOT EXISTS idx_claims_branch_id ON public.claims(branch_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_client_id ON public.claims(client_id);
CREATE INDEX IF NOT EXISTS idx_claims_policy_id ON public.claims(policy_id);

CREATE INDEX IF NOT EXISTS idx_clients_branch_id ON public.clients(branch_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_invoices_branch_id ON public.invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_date ON public.payments(paid_date);

CREATE INDEX IF NOT EXISTS idx_vehicles_client_id ON public.vehicles(client_id);

CREATE INDEX IF NOT EXISTS idx_quotations_client_id ON public.quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles(branch_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
