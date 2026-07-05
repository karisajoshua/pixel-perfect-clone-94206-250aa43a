import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Info, AlertTriangle, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

type Notice = { id: string; title: string; body: string; severity: "info" | "warning" | "critical"; created_at: string };

export function PlatformNoticeBanner() {
  const qc = useQueryClient();
  const { data: notices } = useQuery({
    queryKey: ["my-platform-notices"],
    queryFn: async (): Promise<Notice[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];
      const [{ data: rows }, { data: reads }] = await Promise.all([
        supabase.from("platform_notices")
          .select("id, title, body, severity, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("platform_notice_reads").select("notice_id").eq("user_id", user.user.id),
      ]);
      const readSet = new Set((reads ?? []).map((r: any) => r.notice_id));
      return (rows ?? []).filter((r: any) => !readSet.has(r.id)) as Notice[];
    },
    staleTime: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      await supabase.from("platform_notice_reads").insert({ notice_id: id, user_id: user.user.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-platform-notices"] }),
  });

  if (!notices || notices.length === 0) return null;

  return (
    <div className="border-b bg-muted/30">
      {notices.slice(0, 3).map((n) => {
        const Icon = n.severity === "critical" ? AlertOctagon : n.severity === "warning" ? AlertTriangle : Info;
        const tone =
          n.severity === "critical" ? "bg-destructive/10 text-destructive border-destructive/30" :
          n.severity === "warning" ? "bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/30" :
          "bg-primary/5 text-foreground border-primary/20";
        return (
          <div key={n.id} className={cn("flex items-start gap-3 px-4 py-2 border-b last:border-b-0", tone)}>
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{n.title}</div>
              <div className="text-sm opacity-90 whitespace-pre-wrap">{n.body}</div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dismiss.mutate(n.id)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}