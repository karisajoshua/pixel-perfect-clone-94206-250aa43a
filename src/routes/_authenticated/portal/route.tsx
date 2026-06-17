import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "@/components/portal/portal-shell";

export const Route = createFileRoute("/_authenticated/portal")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (!list.includes("client")) throw redirect({ to: "/dashboard" });
  },
  component: () => (
    <PortalShell>
      <Outlet />
    </PortalShell>
  ),
});