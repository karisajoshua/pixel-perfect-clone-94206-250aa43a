import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { requireRole } from "@/lib/roles";
import { listStaffSessions } from "@/lib/sessions.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/sessions")({
  beforeLoad: requireRole(["admin"]),
  component: Page,
});

function formatDuration(seconds: number) {
  if (!seconds || seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Page() {
  const fn = useServerFn(listStaffSessions);
  const today = new Date();
  const monthAgo = new Date(Date.now() - 30 * 86400_000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [role, setRole] = useState<"manager" | "admin" | "agent" | "viewer">("manager");

  const { data, isLoading } = useQuery({
    queryKey: ["staff-sessions", from, to, role],
    queryFn: () => fn({ data: { from, to: new Date(to + "T23:59:59").toISOString(), role } }),
  });

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Staff sessions" subtitle="Login activity and total time spent on the system." />

      <Card>
        <CardContent className="p-4 grid sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Branch manager</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFrom(monthAgo.toISOString().slice(0, 10));
                setTo(today.toISOString().slice(0, 10));
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Totals per user</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Sessions</th><th className="px-4 py-3">Total time</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && (data?.totals ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No activity in this range.</td></tr>
              )}
              {data?.totals.map((t) => (
                <tr key={t.user_id} className="border-b last:border-0">
                  <td className="px-4 py-2"><div className="font-medium">{t.full_name ?? "—"}</div><div className="text-xs text-muted-foreground">{t.email}</div></td>
                  <td className="px-4 py-2">{t.branch_name ?? "—"}</td>
                  <td className="px-4 py-2">{t.session_count}</td>
                  <td className="px-4 py-2 font-medium">{formatDuration(t.total_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">All sessions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Signed in</th>
                <th className="px-4 py-3">Signed out</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && (data?.sessions ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No sessions.</td></tr>
              )}
              {data?.sessions.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{s.full_name ?? s.email ?? s.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-2">{s.branch_name ?? "—"}</td>
                  <td className="px-4 py-2">{format(new Date(s.started_at), "PPp")}</td>
                  <td className="px-4 py-2">{s.ended_at ? format(new Date(s.ended_at), "PPp") : <span className="text-muted-foreground italic">active (last seen {format(new Date(s.last_seen_at), "p")})</span>}</td>
                  <td className="px-4 py-2 font-medium">{formatDuration(s.duration_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}