
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_sessions_user_started_idx ON public.user_sessions (user_id, started_at DESC);
CREATE INDEX user_sessions_started_idx ON public.user_sessions (started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own sessions" ON public.user_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own sessions" ON public.user_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own sessions" ON public.user_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins read all sessions" ON public.user_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow clients to delete their own general uploads
CREATE POLICY "Client can delete own uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = (public.current_client_id())::text
    AND (storage.foldername(name))[2] = 'uploads'
  );
