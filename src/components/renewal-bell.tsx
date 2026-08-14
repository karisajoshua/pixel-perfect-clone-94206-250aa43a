import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listExpiringCovers } from "@/lib/renewal-alerts.functions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-only";

function daysLeft(endDate: string | null | undefined): number {
  const d = parseLocalDate(endDate);
  if (!d) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400_000);
}

export function RenewalBell({ className }: { className?: string }) {
  const fn = useServerFn(listExpiringCovers);
  const { data } = useQuery({
    queryKey: ["expiring-covers"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const items = data ?? [];
  const count = items.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Expiring covers" className={cn("relative", className)}>
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold grid place-items-center">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b text-sm font-semibold">Covers expiring soon</div>
        {count === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">Nothing expiring in the next 14 days.</div>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {items.map((p: any) => {
              const n = daysLeft(p.end_date);
              const urgent = n <= 7;
              return (
                <li key={p.id}>
                  <Link to="/policies/$id" params={{ id: p.id }} className="block px-3 py-2 hover:bg-muted/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{p.client_name}</span>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5",
                          urgent ? "bg-destructive/10 text-destructive" : "bg-amber-500/15 text-amber-700",
                        )}
                      >
                        {n < 0 ? `${Math.abs(n)}d overdue` : n === 0 ? "today" : `in ${n}d`}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.policy_no}
                      {p.registration_no ? ` · ${p.registration_no}` : ""} · {parseLocalDate(p.end_date)?.toLocaleDateString()}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t px-3 py-2 text-right">
          <Link to="/renewals" className="text-xs text-primary hover:underline">View all renewals</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
