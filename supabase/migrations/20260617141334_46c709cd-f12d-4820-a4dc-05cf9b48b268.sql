
-- 1) Storage: agency-documents -> staff only
DROP POLICY IF EXISTS "Auth read agency docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth write agency docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth update agency docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete agency docs" ON storage.objects;

CREATE POLICY "Staff read agency docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'agency-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent')));
CREATE POLICY "Staff write agency docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'agency-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent')));
CREATE POLICY "Staff update agency docs" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'agency-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent')));
CREATE POLICY "Staff delete agency docs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'agency-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));

-- 2) Storage: client-documents -> staff guard on shared policies (clients keep own-folder read)
DROP POLICY IF EXISTS "client docs read staff" ON storage.objects;
DROP POLICY IF EXISTS "client docs update staff" ON storage.objects;
DROP POLICY IF EXISTS "client docs upload staff" ON storage.objects;

CREATE POLICY "client docs read staff" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent') OR public.has_role(auth.uid(),'viewer')));
CREATE POLICY "client docs upload staff" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent')));
CREATE POLICY "client docs update staff" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent')));

-- 3) client_communications: restrict to staff scope
DROP POLICY IF EXISTS "comm read via client" ON public.client_communications;
CREATE POLICY "comm read staff" ON public.client_communications FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'viewer')
  OR EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_communications.client_id
      AND (c.branch_id = public.user_branch(auth.uid()) OR c.assigned_agent = auth.uid())
  )
);

-- 4) payments: scope to invoice access
DROP POLICY IF EXISTS "Payments follow invoice access" ON public.payments;
CREATE POLICY "payments staff scope" ON public.payments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'viewer')
  OR EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.clients c ON c.id = i.client_id
    WHERE i.id = payments.invoice_id
      AND (c.branch_id = public.user_branch(auth.uid()) OR c.assigned_agent = auth.uid())
  )
);
CREATE POLICY "payments staff write" ON public.payments FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'));

-- 5) invoice_items: scope to invoice access
DROP POLICY IF EXISTS "Items follow invoice access" ON public.invoice_items;
CREATE POLICY "invoice items staff scope" ON public.invoice_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'viewer')
  OR EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.clients c ON c.id = i.client_id
    WHERE i.id = invoice_items.invoice_id
      AND (c.branch_id = public.user_branch(auth.uid()) OR c.assigned_agent = auth.uid())
  )
);
CREATE POLICY "invoice items staff write" ON public.invoice_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'agent'));

-- 6) Remove bare branch_id IS NULL exposure in clients + vehicles
DROP POLICY IF EXISTS "clients read scope" ON public.clients;
CREATE POLICY "clients read scope" ON public.clients FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'viewer')
  OR (
    (public.has_role(auth.uid(),'agent'))
    AND (branch_id IS NULL OR branch_id = public.user_branch(auth.uid()) OR assigned_agent = auth.uid())
  )
);

DROP POLICY IF EXISTS "Staff read vehicles in branch" ON public.vehicles;
CREATE POLICY "Staff read vehicles in branch" ON public.vehicles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'viewer')
  OR (
    public.has_role(auth.uid(),'agent')
    AND (branch_id IS NULL OR branch_id = public.user_branch(auth.uid()))
  )
);

-- 7) Email queue helper functions: pin search_path + revoke from anon/authenticated
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END; $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END; $$;

REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
