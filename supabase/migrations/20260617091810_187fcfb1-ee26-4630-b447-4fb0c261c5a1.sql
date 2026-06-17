
-- Link auth users to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_auth_user_id_key ON public.clients(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Backfill by matching emails
UPDATE public.clients c
SET auth_user_id = u.id
FROM auth.users u
WHERE c.email IS NOT NULL
  AND lower(c.email) = lower(u.email)
  AND c.auth_user_id IS NULL;

-- Replace handle_new_user trigger to link existing client by email and grant 'client' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_first BOOLEAN;
  matched_client uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  -- Try to link to an existing client by email
  SELECT id INTO matched_client FROM public.clients
  WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL
  LIMIT 1;

  IF matched_client IS NOT NULL THEN
    UPDATE public.clients SET auth_user_id = NEW.id WHERE id = matched_client;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');
    RETURN NEW;
  END IF;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  END IF;

  RETURN NEW;
END;
$function$;

-- Helper: get the client_id for current auth user (security definer to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1 $$;

-- RLS policies for portal access
CREATE POLICY "Client can view own client row"
  ON public.clients FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Client can view own policies"
  ON public.policies FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

CREATE POLICY "Client can view own vehicles"
  ON public.vehicles FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

CREATE POLICY "Client can view own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

CREATE POLICY "Client can view own invoice items"
  ON public.invoice_items FOR SELECT TO authenticated
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE client_id = public.current_client_id()));

CREATE POLICY "Client can view own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE client_id = public.current_client_id()));

CREATE POLICY "Client can view own claims"
  ON public.claims FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

CREATE POLICY "Client can report own claims"
  ON public.claims FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id() AND status = 'reported');

CREATE POLICY "Client can view own communications"
  ON public.client_communications FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

-- Storage: client can read own documents under client-documents/<client_id>/*
CREATE POLICY "Client can read own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = public.current_client_id()::text
  );
