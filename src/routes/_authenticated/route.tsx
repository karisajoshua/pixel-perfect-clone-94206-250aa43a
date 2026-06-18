import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    const { data: rolesRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rolesRow ?? []).map((r) => r.role as string);
    if (roles.length > 0 && roles.every((r) => r === "client")) {
      throw redirect({ to: "/portal" });
    }
    return { user: data.user, roles };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});