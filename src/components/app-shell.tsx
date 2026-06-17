import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Car, FileText, FileSignature, Receipt, ScrollText,
  BarChart3, ShieldCheck, LogOut, Building2, BellRing, Settings, Mail, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useMyRoles } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/zia-logo-white.png.asset.json";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/vehicles", label: "Vehicles", icon: Car },
  { to: "/policies", label: "Policies", icon: FileText },
  { to: "/quotations", label: "Quotations", icon: FileSignature },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/claims", label: "Claims", icon: ScrollText },
  { to: "/renewals", label: "Renewals", icon: BellRing },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

const adminNav = [
  { to: "/admin/users", label: "Users & Roles", icon: ShieldCheck },
  { to: "/admin/branches", label: "Branches", icon: Building2 },
  { to: "/admin/insurers", label: "Insurers", icon: ShieldCheck },
  { to: "/admin/import", label: "Data import", icon: Upload },
  { to: "/admin/notifications", label: "Notifications", icon: BellRing },
  { to: "/admin/emails", label: "Email log", icon: Mail },
  { to: "/admin/audit", label: "Audit log", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: roles } = useMyRoles();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = roles?.includes("admin");

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col sticky top-0 h-screen max-h-screen overflow-hidden">
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <img src={logoWhite.url} alt="Zest Insurance Agency" className="h-12 w-auto object-contain" />
          <div className="ml-1">
            <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">Agency Workspace</div>
          </div>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
          {nav.map((n) => (
            <SideLink key={n.to} to={n.to} label={n.label} Icon={n.icon} active={pathname === n.to || pathname.startsWith(n.to + "/")} />
          ))}
          {isAdmin && (
            <>
              <div className="px-3 pt-5 pb-2 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">Admin</div>
              {adminNav.map((n) => (
                <SideLink key={n.to} to={n.to} label={n.label} Icon={n.icon} active={pathname.startsWith(n.to)} />
              ))}
            </>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs">
            <div className="font-medium truncate">{profile?.full_name ?? "Loading…"}</div>
            <div className="text-sidebar-foreground/60 truncate">{roles?.join(", ") || "—"}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}

function SideLink({ to, label, Icon, active }: { to: string; label: string; Icon: typeof Users; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}