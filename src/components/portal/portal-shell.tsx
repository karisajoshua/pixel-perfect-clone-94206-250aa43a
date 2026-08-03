import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPortalOverview } from "@/lib/portal.functions";
import { KycBanner } from "@/components/portal/kyc-banner";
import { LayoutDashboard, FileText, Car, Receipt, ScrollText, FolderOpen, UserCircle, LogOut, MoreHorizontal, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import logoRed from "@/assets/zia-logo-red.png.asset.json";
import { TenantBrandProvider, useTenantBrand } from "@/components/tenant-brand-provider";
import { TourProvider, TourRestartButton } from "@/components/tour/tour-provider";
import { PORTAL_TOUR_ID, portalTourSteps } from "@/components/tour/tour-steps";

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

const mobileTabs: NavItem[] = [
  { to: "/portal", label: "Home", icon: Home, exact: true },
  { to: "/portal/policies", label: "Policies", icon: FileText },
  { to: "/portal/vehicles", label: "Vehicles", icon: Car },
  { to: "/portal/claims", label: "Claims", icon: ScrollText },
];
const mobileMoreItems: NavItem[] = [
  { to: "/portal/invoices", label: "Invoices", icon: Receipt },
  { to: "/portal/documents", label: "Documents", icon: FolderOpen },
  { to: "/portal/profile", label: "Profile", icon: UserCircle },
];

export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <TenantBrandProvider>
      <TourProvider tourId={PORTAL_TOUR_ID} steps={portalTourSteps}>
        <PortalShellInner>{children}</PortalShellInner>
      </TourProvider>
    </TenantBrandProvider>
  );
}

function PortalShellInner({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useMyProfile();
  const brand = useTenantBrand();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const overviewFn = useServerFn(getPortalOverview);
  const { data: overview } = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => overviewFn(),
    staleTime: 60_000,
  });

  const signOut = async () => {
    // Navigate away first so authenticated components unmount and don't
    // resubscribe to cleared queries (which would refetch without a token).
    navigate({ to: "/", replace: true });
    await qc.cancelQueries();
    await supabase.auth.signOut();
    qc.clear();
  };

  const initial = (profile?.full_name ?? "?").trim().charAt(0).toUpperCase();
  const isMoreActive = mobileMoreItems.some(
    (n) => pathname === n.to || pathname.startsWith(n.to + "/"),
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header
        className="h-14 md:h-16 border-b bg-card/90 backdrop-blur flex items-center px-4 md:px-6 gap-3 sticky top-0 z-20"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <img src={brand?.logo_url ?? logoRed.url} alt={brand?.name ?? "Agency"} className="h-8 md:h-9 w-auto object-contain" />
        <div className="hidden md:block">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Client Portal</div>
          <div className="text-sm font-medium leading-tight">Welcome, {profile?.full_name ?? "…"}</div>
        </div>
        <div className="ml-auto">
          <div className="hidden md:block">
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold grid place-items-center"
                  aria-label="Account menu"
                >
                  {initial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{profile?.full_name ?? "Account"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/portal/profile" })}>
                  <UserCircle className="h-4 w-4 mr-2" /> Profile
                </DropdownMenuItem>
                <PortalTourMenuItem />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                  data-tour={`portal-nav-${n.to}`}
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
          <div className="p-4 sm:p-6 space-y-4 pb-24 md:pb-6">
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
      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-card/90 backdrop-blur border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {mobileTabs.map((n) => {
            const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  data-tour={`portal-nav-${n.to}`}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {active && <span className="absolute top-0 h-0.5 w-8 bg-primary rounded-b-full" />}
                  <n.icon className="h-5 w-5" />
                  <span>{n.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 py-2 w-full min-h-[56px] text-[10px] font-medium transition-colors",
                    isMoreActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {isMoreActive && <span className="absolute top-0 h-0.5 w-8 bg-primary rounded-b-full" />}
                  <MoreHorizontal className="h-5 w-5" />
                  <span>More</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>More</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid gap-1">
                  {mobileMoreItems.map((n) => {
                    const active = pathname === n.to || pathname.startsWith(n.to + "/");
                    return (
                      <Link
                        key={n.to}
                        to={n.to}
                        data-tour={`portal-nav-${n.to}`}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm",
                          active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
                        )}
                      >
                        <n.icon className="h-5 w-5" />
                        {n.label}
                      </Link>
                    );
                  })}
                  <TourRestartButton className="hover:bg-muted" />
                  <button
                    onClick={signOut}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-destructive hover:bg-destructive/10 text-left"
                  >
                    <LogOut className="h-5 w-5" /> Sign out
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </div>
  );
}