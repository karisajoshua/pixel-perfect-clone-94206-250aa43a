import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Car, FileText, FileSignature, Receipt, ScrollText,
  BarChart3, ShieldCheck, LogOut, Building2, BellRing, Settings, Mail, Upload,
  BookOpen, Menu, Inbox, KeyRound, Clock, MoreHorizontal, Sparkles,
  Plug,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useMyRoles } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/zia-logo-white.png.asset.json";
import { AiAssistant } from "@/components/ai-assistant";
import { TenantBrandProvider, useTenantBrand } from "@/components/tenant-brand-provider";
import { PlatformNoticeBanner } from "@/components/platform-notice-banner";

type Role = "admin" | "manager" | "agent" | "viewer" | "client";
const nav: { to: string; label: string; icon: typeof Users; roles: Role[] }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "agent", "viewer"] },
  { to: "/clients", label: "Clients", icon: Users, roles: ["admin", "manager", "agent"] },
  { to: "/clients/kra-checker", label: "KRA PIN checker", icon: ShieldCheck, roles: ["admin", "manager", "agent"] },
  { to: "/quotations", label: "Quotations", icon: FileSignature, roles: ["admin", "manager", "agent"] },
  { to: "/policies", label: "Policies", icon: FileText, roles: ["admin", "manager", "agent"] },
  { to: "/invoices", label: "Invoices", icon: Receipt, roles: ["admin", "manager", "agent"] },
  { to: "/claims", label: "Claims", icon: ScrollText, roles: ["admin", "manager", "agent"] },
  { to: "/renewals", label: "Renewals", icon: BellRing, roles: ["admin", "manager", "agent", "viewer"] },
  { to: "/admin/requests", label: "Service requests", icon: Inbox, roles: ["admin", "manager", "agent"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager", "agent", "viewer"] },
  { to: "/assistant", label: "AI assistant", icon: Sparkles, roles: ["admin", "manager", "agent", "viewer"] },
];

const adminNav = [
  { to: "/admin/users", label: "Users & Roles", icon: ShieldCheck },
  { to: "/admin/tenant", label: "Agency & Brand", icon: Building2 },
  { to: "/admin/sessions", label: "Staff sessions", icon: Clock },
  { to: "/admin/branches", label: "Branches", icon: Building2 },
  { to: "/admin/insurers", label: "Insurers", icon: ShieldCheck },
  { to: "/admin/import", label: "Data import", icon: Upload },
  { to: "/admin/notifications", label: "Notifications", icon: BellRing },
  { to: "/admin/emails", label: "Email log", icon: Mail },
  { to: "/admin/audit", label: "Audit log", icon: Settings },
  { to: "/admin/security", label: "Account security", icon: KeyRound },
  { to: "/admin/docs", label: "Documentation", icon: BookOpen },
  { to: "/admin/ipen", label: "IPEN integration", icon: Plug },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TenantBrandProvider>
      <AppShellInner>{children}</AppShellInner>
    </TenantBrandProvider>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: roles } = useMyRoles();
  const brand = useTenantBrand();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = roles?.includes("admin");
  const isSuper = roles?.includes("super_admin" as any);
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleNav = nav.filter((n) => (roles ?? []).some((r) => n.roles.includes(r as Role)));

  const agencyName = brand?.name ?? "Agency";
  const agencyLogo = brand?.logo_url ?? logoWhite.url;
  const currentTitle =
    visibleNav.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"))?.label ??
    adminNav.find((n) => pathname.startsWith(n.to))?.label ??
    agencyName;

  const tabs: { to: string; label: string; icon: typeof Users }[] = [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/clients", label: "Clients", icon: Users },
    { to: "/quotations", label: "Quotes", icon: FileSignature },
    { to: "/invoices", label: "Invoices", icon: Receipt },
  ];
  const visibleTabs = tabs.filter((t) => visibleNav.some((n) => n.to === t.to));

  const initials = (profile?.full_name ?? "Z")
    .split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "Z";

  const signOut = async () => {
    navigate({ to: "/", replace: true });
    await qc.cancelQueries();
    await supabase.auth.signOut();
    qc.clear();
  };

  const sidebarContent = (
    <>
      <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
        <img src={agencyLogo} alt={agencyName} className="h-12 w-auto object-contain bg-white/5 rounded p-1" />
        <div className="ml-1">
          <div className="text-sm font-semibold text-sidebar-foreground truncate max-w-[10rem]">{agencyName}</div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Agency Workspace</div>
        </div>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5" onClick={() => setMobileOpen(false)}>
        {visibleNav.map((n) => (
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
        {isSuper && (
          <>
            <div className="px-3 pt-5 pb-2 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">Platform</div>
            <SideLink to="/platform" label="Super admin portal" Icon={ShieldCheck} active={pathname.startsWith("/platform")} />
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
    </>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden lg:flex w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col sticky top-0 h-screen max-h-screen overflow-hidden">
        {sidebarContent}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground flex flex-col">
          {sidebarContent}
        </SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0 overflow-auto flex flex-col">
        <div
          className="lg:hidden flex items-center gap-2 px-3 sticky top-0 bg-sidebar text-sidebar-foreground z-30 shadow-sm"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)", paddingBottom: "0.5rem" }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <img src={agencyLogo} alt={agencyName} className="h-7 w-auto object-contain" />
          <div className="ml-1 text-sm font-semibold truncate">{currentTitle}</div>
          <div className="ml-auto h-8 w-8 rounded-full bg-sidebar-accent text-sidebar-accent-foreground grid place-items-center text-xs font-semibold">
            {initials}
          </div>
        </div>
        <PlatformNoticeBanner />
        <div className="flex-1 min-w-0 pb-24 lg:pb-0">{children}</div>
        <footer className="border-t px-4 py-3 text-xs text-muted-foreground text-center hidden lg:block">
          Powered by Texcortech Systems
        </footer>
      </main>
      {/* Mobile/tablet bottom tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className={cn("grid", `grid-cols-${visibleTabs.length + 1}`)} style={{ gridTemplateColumns: `repeat(${visibleTabs.length + 1}, minmax(0, 1fr))` }}>
          {visibleTabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{t.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>
      <AiAssistant />
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