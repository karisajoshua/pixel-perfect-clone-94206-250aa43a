import { useState } from "react";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Building2, LayoutDashboard, LogOut, ShieldCheck, Megaphone, ScrollText, Menu, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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

const navItems = [
  { to: "/platform", label: "Overview", icon: LayoutDashboard },
  { to: "/platform/agencies", label: "Agencies", icon: Building2 },
  { to: "/platform/notices", label: "Notices", icon: Megaphone },
  { to: "/platform/whatsapp", label: "WhatsApp health", icon: MessageCircle },
  { to: "/platform/audit", label: "Audit log", icon: ScrollText },
] as const;

function PlatformLayout() {
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const navContent = (
    <>
      <div className="px-2 pb-4 border-b border-sidebar-border mb-2">
        <div className="text-xs uppercase opacity-70">Platform</div>
        <div className="font-semibold">Super Admin</div>
      </div>
      {navItems.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-sidebar-accent"
        >
          <n.icon size={16} /> {n.label}
        </Link>
      ))}
      <Link
        to="/dashboard"
        onClick={() => setOpen(false)}
        className="flex items-center gap-2 px-3 py-2 rounded hover:bg-sidebar-accent mt-auto"
      >
        <ShieldCheck size={16} /> My agency workspace
      </Link>
      <Button variant="ghost" onClick={signOut} className="justify-start text-sidebar-foreground hover:bg-sidebar-accent">
        <LogOut size={16} className="mr-2" /> Sign out
      </Button>
    </>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside className="hidden lg:flex w-60 bg-sidebar text-sidebar-foreground p-4 flex-col gap-1 shrink-0 sticky top-0 h-screen overflow-y-auto">
        {navContent}
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground p-4 flex flex-col gap-1">
          {navContent}
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0">
        <div
          className="lg:hidden sticky top-0 z-30 flex items-center gap-2 px-3 bg-sidebar text-sidebar-foreground shadow-sm"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)", paddingBottom: "0.5rem" }}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="text-[10px] uppercase opacity-70 leading-none">Platform</div>
            <div className="text-sm font-semibold truncate">Super Admin</div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
