import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useMyRoles } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/emails")({ beforeLoad: requireRole(["admin"]), component: EmailsPage });

type Row = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

const RANGES = { "24h": 1, "7d": 7, "30d": 30 } as const;
type RangeKey = keyof typeof RANGES;

function EmailsPage() {
  const { data: roles } = useMyRoles();
  const isAdmin = roles?.includes("admin");
  const [range, setRange] = useState<RangeKey>("7d");
  const [template, setTemplate] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const since = useMemo(
    () => new Date(Date.now() - RANGES[range] * 86_400_000).toISOString(),
    [range],
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["email-log", range],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Deduplicate by message_id, keeping latest (rows already DESC).
  const deduped = useMemo(() => {
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const r of rows) {
      const key = r.message_id ?? r.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }, [rows]);

  const templates = useMemo(
    () => Array.from(new Set(deduped.map((r) => r.template_name).filter(Boolean))) as string[],
    [deduped],
  );

  const filtered = useMemo(
    () =>
      deduped.filter(
        (r) =>
          (template === "all" || r.template_name === template) &&
          (status === "all" || r.status === status),
      ),
    [deduped, template, status],
  );

  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, suppressed: 0 };
    for (const r of filtered) {
      if (r.status === "sent") s.sent += 1;
      else if (r.status === "dlq" || r.status === "failed" || r.status === "bounced") s.failed += 1;
      else if (r.status === "suppressed" || r.status === "complained") s.suppressed += 1;
    }
    return s;
  }, [filtered]);

  if (!isAdmin) {
    return (
      <div className="p-8">
        <PageHeader title="Email log" subtitle="Admin access required." />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Email log" subtitle="Delivery activity for transactional emails. Deduplicated by message." />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 rounded-md border p-1">
          {(Object.keys(RANGES) as RangeKey[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={range === k ? "default" : "ghost"}
              onClick={() => setRange(k)}
            >
              {k === "24h" ? "Last 24h" : k === "7d" ? "Last 7 days" : "Last 30 days"}
            </Button>
          ))}
        </div>
        <Select value={template} onValueChange={setTemplate}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Template" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="dlq">Failed (DLQ)</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
            <SelectItem value="suppressed">Suppressed</SelectItem>
            <SelectItem value="complained">Complained</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total emails" value={stats.total} />
        <Stat label="Sent" value={stats.sent} tone="success" />
        <Stat label="Failed" value={stats.failed} tone="danger" />
        <Stat label="Suppressed" value={stats.suppressed} tone="warn" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No emails in this range.</td></tr>
              )}
              {filtered.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="px-4 py-3 font-mono text-xs">{r.template_name ?? "—"}</td>
                  <td className="px-4 py-3">{r.recipient_email ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-destructive max-w-[280px] truncate">
                    {r.error_message ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div className="p-3 text-xs text-muted-foreground text-center">
              Showing 100 of {filtered.length} rows. Narrow filters to see more.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "warn" }) {
  const color =
    tone === "success" ? "text-emerald-600"
    : tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-amber-600"
    : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const v: "default" | "secondary" | "destructive" =
    status === "sent" ? "default"
    : status === "dlq" || status === "failed" || status === "bounced" ? "destructive"
    : "secondary";
  return <Badge variant={v}>{status}</Badge>;
}