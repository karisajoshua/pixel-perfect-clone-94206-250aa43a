import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useSessionTracker } from "@/hooks/use-session-tracker";

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
    // Multi-tenant gate: user must belong to an agency (or be super admin).
    const { data: member } = await supabase
      .from("tenant_members").select("tenant_id").eq("user_id", data.user.id).maybeSingle();
    const isSuper = roles.includes("super_admin");
    if (!member && !isSuper) {
      // Fallback: if this auth user is linked to a client record, it's a
      // portal user — send them to /portal instead of the agency onboarding.
      const { data: clientRow } = await supabase
        .from("clients").select("id").eq("auth_user_id", data.user.id).maybeSingle();
      if (clientRow) throw redirect({ to: "/portal" });
      throw redirect({ to: "/onboarding" });
    }
    return { user: data.user, roles };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  useSessionTracker();
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}