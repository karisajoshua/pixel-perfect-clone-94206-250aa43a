import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getIpenPortalDashboard } from "@/lib/ipen/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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
          <pre className="whitespace-pre-wrap bg-muted/40 p-3 rounded-md text-xs overflow-x-auto max-h-72">
            {JSON.stringify(q.data, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}