import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Building2, LayoutDashboard, LogOut, ShieldCheck, Megaphone, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_platform")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    const { data: roles } = await supabase.from("user_roles")
      .select("role").eq("user_id", data.user.id).eq("role", "super_admin").maybeSingle();
    if (!roles) throw redirect({ to: "/dashboard" });
  },
  component: PlatformLayout,
});

function PlatformLayout() {
  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };
  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside className="w-60 bg-sidebar text-sidebar-foreground p-4 flex flex-col gap-1 shrink-0">
        <div className="px-2 pb-4 border-b border-sidebar-border mb-2">
          <div className="text-xs uppercase opacity-70">Platform</div>
          <div className="font-semibold">Super Admin</div>
        </div>
        <Link to="/platform" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-sidebar-accent"><LayoutDashboard size={16} /> Overview</Link>
        <Link to="/platform/agencies" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-sidebar-accent"><Building2 size={16} /> Agencies</Link>
        <Link to="/platform/notices" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-sidebar-accent"><Megaphone size={16} /> Notices</Link>
        <Link to="/platform/audit" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-sidebar-accent"><ScrollText size={16} /> Audit log</Link>
        <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-sidebar-accent mt-auto"><ShieldCheck size={16} /> My agency workspace</Link>
        <Button variant="ghost" onClick={signOut} className="justify-start text-sidebar-foreground hover:bg-sidebar-accent"><LogOut size={16} className="mr-2" /> Sign out</Button>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}