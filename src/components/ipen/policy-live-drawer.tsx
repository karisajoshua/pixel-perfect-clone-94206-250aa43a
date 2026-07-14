import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useServerFn } from "@tanstack/react-start";
import { getPolicy } from "@/lib/ipen/policies.functions";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SmartRender } from "@/lib/ipen/render";

export function IpenPolicyLiveDrawer({ open, onOpenChange, ipenPolicyId }: { open: boolean; onOpenChange: (o: boolean) => void; ipenPolicyId: string }) {
  const fn = useServerFn(getPolicy);
  const q = useQuery({
    queryKey: ["ipen","policy", ipenPolicyId],
    enabled: open && !!ipenPolicyId,
    queryFn: () => fn({ data: { policyId: ipenPolicyId } }),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>Live IPEN policy</SheetTitle></SheetHeader>
        <div className="mt-4 text-sm">
          {q.isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
          {q.error && <div className="text-destructive">{(q.error as Error).message}</div>}
          {q.data && (
            <SmartRender data={q.data} emptyLabel="No policy details." />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}