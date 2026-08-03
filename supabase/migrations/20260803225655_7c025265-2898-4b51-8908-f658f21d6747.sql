CREATE TABLE public.user_tour_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_step INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tour_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tour_progress TO authenticated;
GRANT ALL ON public.user_tour_progress TO service_role;

ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tour progress"
ON public.user_tour_progress FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER user_tour_progress_set_updated_at
BEFORE UPDATE ON public.user_tour_progress
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();