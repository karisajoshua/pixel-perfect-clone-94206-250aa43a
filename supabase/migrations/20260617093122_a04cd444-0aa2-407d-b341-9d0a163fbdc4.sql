GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_branch(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated, anon;