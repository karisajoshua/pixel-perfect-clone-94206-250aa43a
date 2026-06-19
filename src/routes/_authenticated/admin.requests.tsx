import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAllServiceRequests, updateServiceRequest } from "@/lib/service-requests.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  beforeLoad: requireRole(["admin", "manager", "agent"]),
  component: RequestsPage,
});

function RequestsPage() {
  const list = useServerFn(listAllServiceRequests);
  const update = useServerFn(updateServiceRequest);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("open");
  const { data, isLoading } = useQuery({
    queryKey: ["service-requests"],
    queryFn: () => list(),
    staleTime: 30_000,
  });
  const m = useMutation({
    mutationFn: (vars: { id: string; status: any }) => update({ data: vars }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["service-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const rows = ((data as any[]) ?? []).filter((r) => filter === "all" || r.status === filter);
  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Service requests" subtitle="Renewal, cancellation and callback requests submitted by clients via the portal." />
      <div className="flex gap-1 flex-wrap">
        {["open", "in_progress", "resolved", "rejected", "all"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s.replace("_", " ")}
          </Button>
        ))}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Policy</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">No requests.</td></tr>
              )}
              {rows.map((r: any) => {
                const cl = r.clients;
                const name = cl ? (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) : "—";
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><div className="font-medium">{name}</div><div className="text-xs text-muted-foreground">{cl?.email ?? cl?.phone ?? "—"}</div></td>
                    <td className="px-4 py-3 font-mono text-xs">{r.policies?.policy_no ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{r.request_type}</Badge></td>
                    <td className="px-4 py-3">{r.preferred_contact}</td>
                    <td className="px-4 py-3 max-w-sm text-xs text-muted-foreground">{r.reason ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Select value={r.status} onValueChange={(v) => m.mutate({ id: r.id, status: v })}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["open", "in_progress", "resolved", "rejected"].map((s) => (
                            <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}