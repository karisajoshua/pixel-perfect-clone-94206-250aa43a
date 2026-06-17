
CREATE TABLE public.insurers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  short_code text,
  contact_email text,
  contact_phone text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurers TO authenticated;
GRANT ALL ON public.insurers TO service_role;
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read insurers" ON public.insurers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage insurers" ON public.insurers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER tg_insurers_updated BEFORE UPDATE ON public.insurers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  registration_no text NOT NULL,
  make text, model text, year int, body_type text, color text,
  chassis_no text, engine_no text, fuel_type text,
  seating_capacity int, cubic_capacity int,
  usage_type text DEFAULT 'private',
  estimated_value numeric(14,2),
  logbook_url text, inspection_due date, notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vehicles_reg_unique ON public.vehicles (lower(registration_no));
CREATE INDEX vehicles_client_idx ON public.vehicles (client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read vehicles in branch" ON public.vehicles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
         OR branch_id IS NULL OR branch_id = public.user_branch(auth.uid()));
CREATE POLICY "Staff write vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'));
CREATE TRIGGER tg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_no text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  insurer_id uuid REFERENCES public.insurers(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  product_class text NOT NULL DEFAULT 'motor_private',
  cover_type text NOT NULL DEFAULT 'comprehensive',
  sum_insured numeric(14,2),
  premium_gross numeric(14,2),
  premium_net numeric(14,2),
  commission numeric(14,2),
  taxes numeric(14,2),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  payment_status text NOT NULL DEFAULT 'unpaid',
  previous_policy_id uuid REFERENCES public.policies(id) ON DELETE SET NULL,
  document_url text, notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX policies_no_unique ON public.policies (lower(policy_no));
CREATE INDEX policies_client_idx ON public.policies (client_id);
CREATE INDEX policies_end_date_idx ON public.policies (end_date);
CREATE INDEX policies_status_idx ON public.policies (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read policies in branch" ON public.policies FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
         OR branch_id IS NULL OR branch_id = public.user_branch(auth.uid()));
CREATE POLICY "Staff write policies" ON public.policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'));
CREATE TRIGGER tg_policies_updated BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_no text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  insurer_id uuid REFERENCES public.insurers(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  product_class text NOT NULL DEFAULT 'motor_private',
  cover_type text NOT NULL DEFAULT 'comprehensive',
  sum_insured numeric(14,2),
  premium_gross numeric(14,2),
  premium_net numeric(14,2),
  valid_until date,
  status text NOT NULL DEFAULT 'draft',
  converted_policy_id uuid REFERENCES public.policies(id) ON DELETE SET NULL,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX quotations_no_unique ON public.quotations (lower(quote_no));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read quotations in branch" ON public.quotations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
         OR branch_id IS NULL OR branch_id = public.user_branch(auth.uid()));
CREATE POLICY "Staff write quotations" ON public.quotations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'));
CREATE TRIGGER tg_quotations_updated BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "Auth read agency docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'agency-documents');
CREATE POLICY "Auth write agency docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'agency-documents');
CREATE POLICY "Auth update agency docs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'agency-documents');
CREATE POLICY "Auth delete agency docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'agency-documents');
