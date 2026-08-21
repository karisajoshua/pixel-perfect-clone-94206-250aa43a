import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformAuditLog, getPlatformOverview } from "@/lib/platform.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_platform/platform/audit")({
  head: () => ({ meta: [{ title: "Platform audit — Platform" }] }),
  component: AuditPage,
});

function AuditPage() {
  const [tenantId, setTenantId] = useState<string>("all");
  const [action, setAction] = useState<string>("");
  const auditFn = useServerFn(getPlatformAuditLog);
  const overviewFn = useServerFn(getPlatformOverview);
  const { data: overview } = useQuery({ queryKey: ["platform-overview"], queryFn: () => overviewFn() });
  const { data: rows } = useQuery({
    queryKey: ["platform-audit", tenantId, action],
    queryFn: () => auditFn({ data: {
      tenant_id: tenantId === "all" ? null : tenantId,
      action: action.trim() ? action.trim() : null,
      limit: 200,
    } }),
  });

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Platform audit log</h1>
        <p className="text-sm text-muted-foreground">Recent activity across every agency.</p>
      </div>
      <Card>
        <CardHeader className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <div className="w-full sm:w-64 min-w-0">
            <label className="text-xs text-muted-foreground">Agency</label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agencies</SelectItem>
                {(overview?.agencies ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-64 min-w-0">
            <label className="text-xs text-muted-foreground">Action</label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. policy.created" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.tenant_name ?? "—"}</TableCell>
                  <TableCell>{r.user_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.action}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.entity_type ?? "—"} {r.entity_id ? `· ${String(r.entity_id).slice(0,8)}` : ""}</TableCell>
                </TableRow>
              ))}
              {(!rows || rows.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nothing to show.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}