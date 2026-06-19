
-- Claims structured fields
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS accident_statement text,
  ADD COLUMN IF NOT EXISTS third_party_details jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Quotations approval workflow
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_quote_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL;

-- Vehicles inspection scheduling
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS next_inspection_date date;

-- Service requests from portal
CREATE TABLE IF NOT EXISTS public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.policies(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('renewal','cancellation','info','callback')),
  preferred_contact text NOT NULL DEFAULT 'email' CHECK (preferred_contact IN ('email','phone','whatsapp','sms')),
  reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','rejected')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own service requests" ON public.service_requests FOR ALL TO authenticated
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

CREATE POLICY "Staff read service requests in branch" ON public.service_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
         OR branch_id IS NULL OR branch_id = public.user_branch(auth.uid()));

CREATE POLICY "Staff update service requests" ON public.service_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'));

CREATE TRIGGER tg_service_requests_updated BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS service_requests_client_idx ON public.service_requests (client_id);
CREATE INDEX IF NOT EXISTS service_requests_status_idx ON public.service_requests (status);
