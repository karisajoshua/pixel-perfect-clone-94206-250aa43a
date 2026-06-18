import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPortalOverview } from "@/lib/portal.functions";
import { KycBanner } from "@/components/portal/kyc-banner";
import { LayoutDashboard, FileText, Car, Receipt, ScrollText, FolderOpen, UserCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import logoRed from "@/assets/zia-logo-red.png.asset.json";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const nav: NavItem[] = [
  { to: "/portal", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/portal/policies", label: "My Policies", icon: FileText },
  { to: "/portal/vehicles", label: "Vehicles", icon: Car },
  { to: "/portal/invoices", label: "Invoices", icon: Receipt },
  { to: "/portal/claims", label: "Claims", icon: ScrollText },
  { to: "/portal/documents", label: "Documents", icon: FolderOpen },
  { to: "/portal/profile", label: "Profile", icon: UserCircle },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useMyProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const overviewFn = useServerFn(getPortalOverview);
  const { data: overview } = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => overviewFn(),
    staleTime: 60_000,
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="h-16 border-b bg-card flex items-center px-6 gap-4 sticky top-0 z-10">
        <img src={logoRed.url} alt="Zest Insurance Agency" className="h-9 w-auto object-contain" />
        <div className="hidden sm:block">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Client Portal</div>
          <div className="text-sm font-medium leading-tight">Welcome, {profile?.full_name ?? "…"}</div>
        </div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </header>
      <div className="flex-1 flex">
        <aside className="w-60 shrink-0 border-r bg-card/30 hidden md:block">
          <nav className="p-3 space-y-0.5">
            {nav.map((n) => {
              const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 overflow-auto">
          <nav className="md:hidden border-b bg-card/30 px-3 py-2 flex gap-1 overflow-x-auto">
            {nav.map((n) => {
              const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link key={n.to} to={n.to} className={cn("text-xs px-3 py-1.5 rounded-md whitespace-nowrap", active ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 sm:p-6 space-y-4">
            {overview?.kyc && !overview.kyc.complete && (
              <KycBanner
                status={overview.kyc.status}
                missingFields={overview.kyc.missingFields}
                hasUploadedDocs={overview.kyc.hasUploadedDocs}
              />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}