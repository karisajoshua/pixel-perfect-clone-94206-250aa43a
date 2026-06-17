import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/audit")({ component: AuditLog });

function AuditLog() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Audit log" subtitle="Sensitive actions across the system." />
      <Card>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th></tr></thead>
          <tbody>
            {data?.length === 0 && <tr><td colSpan={3} className="p-12 text-center text-muted-foreground">No entries.</td></tr>}
            {data?.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="px-4 py-3">{format(new Date(a.created_at), "PPp")}</td>
                <td className="px-4 py-3">{a.action}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.entity_type ?? "—"} {a.entity_id ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}