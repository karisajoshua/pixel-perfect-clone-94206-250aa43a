import * as React from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-only";

export type ExpiringPolicy = { id: string; policy_no: string; end_date: string };

export function daysUntil(endDate: string | null | undefined): number {
  const d = parseLocalDate(endDate);
  if (!d) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400_000);
}

export function RenewalBanner({ policies }: { policies: ExpiringPolicy[] }) {
  const [dismissed, setDismissed] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem("portal-renewal-dismissed");
      if (raw) setDismissed(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { sessionStorage.setItem("portal-renewal-dismissed", JSON.stringify(next)); } catch { /* ignore */ }
  };

  const visible = (policies ?? []).filter((p) => !dismissed.includes(p.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((p) => {
        const n = daysUntil(p.end_date);
        const urgent = n <= 7;
        const when = parseLocalDate(p.end_date)?.toLocaleDateString(undefined, { day: "numeric", month: "short" });
        return (
          <div
            key={p.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 text-sm",
              urgent ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-amber-500/40 bg-amber-500/10 text-amber-800",
            )}
          >
            <CalendarClock className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span>
                Your cover <strong>{p.policy_no}</strong> expires on {when}
                {urgent ? ` — in ${n <= 0 ? "less than a day" : `${n} day${n === 1 ? "" : "s"}`}. Contact us to renew.` : ` (in ${n} days).`}
              </span>{" "}
              <Link to="/portal/policies/$id" params={{ id: p.id }} className="underline font-medium">
                View policy
              </Link>
            </div>
            <button type="button" onClick={() => dismiss(p.id)} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
