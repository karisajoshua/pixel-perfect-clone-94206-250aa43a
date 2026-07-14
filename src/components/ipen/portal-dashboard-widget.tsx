import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getIpenPortalDashboard } from "@/lib/ipen/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { SmartRender } from "@/lib/ipen/render";

export function IpenPortalDashboardWidget() {
  const fn = useServerFn(getIpenPortalDashboard);
  const q = useQuery({ queryKey: ["ipen", "portal", "dashboard"], queryFn: () => fn() });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live from IPEN</CardTitle>
        <CardDescription>Your IPEN portfolio at a glance.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {q.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {q.error && (
          <div className="text-destructive text-xs">{(q.error as Error).message}</div>
        )}
        {q.data && (
          <SmartRender data={q.data} emptyLabel="Nothing to show yet." />
        )}
      </CardContent>
    </Card>
  );
}