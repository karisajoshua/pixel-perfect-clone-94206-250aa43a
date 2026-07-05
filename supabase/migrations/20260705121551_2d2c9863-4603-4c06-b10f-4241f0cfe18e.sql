
-- Platform notices
CREATE TABLE public.platform_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  audience text NOT NULL CHECK (audience IN ('all','tenant')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_notices TO authenticated;
GRANT ALL ON public.platform_notices TO service_role;

ALTER TABLE public.platform_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins manage notices"
  ON public.platform_notices FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "tenant members read own notices"
  ON public.platform_notices FOR SELECT
  TO authenticated
  USING (
    audience = 'all'
    OR (audience = 'tenant' AND tenant_id = public.current_tenant_id())
  );

CREATE TRIGGER platform_notices_updated_at
  BEFORE UPDATE ON public.platform_notices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Platform notice reads (per-user dismissal)
CREATE TABLE public.platform_notice_reads (
  notice_id uuid NOT NULL REFERENCES public.platform_notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.platform_notice_reads TO authenticated;
GRANT ALL ON public.platform_notice_reads TO service_role;

ALTER TABLE public.platform_notice_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own notice reads"
  ON public.platform_notice_reads FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
