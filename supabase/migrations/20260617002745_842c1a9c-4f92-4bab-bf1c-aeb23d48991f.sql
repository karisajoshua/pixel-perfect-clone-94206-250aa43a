
CREATE TYPE public.client_type AS ENUM ('individual', 'corporate');
CREATE TYPE public.kyc_status AS ENUM ('pending', 'verified', 'rejected', 'expired');
CREATE TYPE public.comm_channel AS ENUM ('call', 'email', 'sms', 'whatsapp', 'in_person', 'note');
CREATE TYPE public.comm_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_type public.client_type NOT NULL DEFAULT 'individual',
  full_name TEXT NOT NULL,
  company_name TEXT,
  id_number TEXT,
  kra_pin TEXT,
  email TEXT,
  phone TEXT,
  alt_phone TEXT,
  address TEXT,
  city TEXT,
  date_of_birth DATE,
  occupation TEXT,
  kyc_status public.kyc_status NOT NULL DEFAULT 'pending',
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  assigned_agent UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE INDEX clients_branch_idx ON public.clients(branch_id);
CREATE INDEX clients_agent_idx ON public.clients(assigned_agent);
CREATE INDEX clients_name_idx ON public.clients USING gin (to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(company_name,'')));

CREATE TRIGGER set_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Same-branch helper
CREATE OR REPLACE FUNCTION public.user_branch(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT branch_id FROM public.profiles WHERE id = _user_id $$;
REVOKE EXECUTE ON FUNCTION public.user_branch(UUID) FROM PUBLIC, anon;

CREATE POLICY "clients read scope" ON public.clients
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'viewer')
    OR branch_id IS NULL
    OR branch_id = public.user_branch(auth.uid())
    OR assigned_agent = auth.uid()
  );
CREATE POLICY "clients insert staff" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
  );
CREATE POLICY "clients update staff" ON public.clients
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR (public.has_role(auth.uid(), 'agent') AND (branch_id = public.user_branch(auth.uid()) OR assigned_agent = auth.uid()))
  );
CREATE POLICY "clients delete admin" ON public.clients
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.client_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel public.comm_channel NOT NULL,
  direction public.comm_direction NOT NULL DEFAULT 'outbound',
  subject TEXT,
  body TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_communications TO authenticated;
GRANT ALL ON public.client_communications TO service_role;
ALTER TABLE public.client_communications ENABLE ROW LEVEL SECURITY;
CREATE INDEX client_comm_client_idx ON public.client_communications(client_id);

CREATE POLICY "comm read via client" ON public.client_communications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id)
  );
CREATE POLICY "comm insert staff" ON public.client_communications
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "comm delete admin" ON public.client_communications
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
