import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, ChevronRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOnboardingStatus } from "@/lib/portal.functions";
import { cn } from "@/lib/utils";

export function OnboardingChecklist() {
  const fn = useServerFn(getOnboardingStatus);
  const { data } = useQuery({ queryKey: ["onboarding-status"], queryFn: () => fn(), staleTime: 60_000 });
  if (!data || data.items.length === 0) return null;
  if (data.complete) return null;

  const total = data.items.length;
  const done = data.items.filter((i) => i.done).length;

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Finish setting up your workspace</CardTitle>
        </div>
        <Badge variant="secondary">{done}/{total}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 text-sm hover:bg-muted/50 transition-colors",
                  item.done && "text-muted-foreground",
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={cn("flex-1", item.done && "line-through")}>{item.label}</span>
                {item.required && !item.done && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}