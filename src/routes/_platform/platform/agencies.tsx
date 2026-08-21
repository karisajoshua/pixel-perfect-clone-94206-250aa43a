import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformOverview } from "@/lib/platform.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SendNoticeDialog } from "@/components/platform/send-notice-dialog";
import { Megaphone, Search } from "lucide-react";

export const Route = createFileRoute("/_platform/platform/agencies")({
  head: () => ({ meta: [{ title: "Agencies — Platform" }] }),
  component: AgenciesList,
});

function AgenciesList() {
  const fetchFn = useServerFn(getPlatformOverview);
  const { data } = useQuery({ queryKey: ["platform-overview"], queryFn: () => fetchFn() });
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [plan, setPlan] = useState<string>("all");
  const [sortKey, setSortKey] = useState<string>("name");

  const rows = useMemo(() => {
    const list = (data?.agencies ?? []).filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (plan !== "all" && a.plan !== plan) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        if (!a.name.toLowerCase().includes(s) && !(a.contact_email ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
    const sorted = [...list].sort((a, b) => {
      switch (sortKey) {
        case "clients": return b.clients - a.clients;
        case "policies": return b.activePolicies - a.activePolicies;
        case "revenue": return b.revenue - a.revenue;
        case "onboarded": return (b.onboarded_at ?? "").localeCompare(a.onboarded_at ?? "");
        default: return a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [data, q, status, plan, sortKey]);

  const plans = Array.from(new Set((data?.agencies ?? []).map((a) => a.plan))).filter(Boolean);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">All agencies</h1>
          <p className="text-sm text-muted-foreground">Click an agency to drill in.</p>
        </div>
        <SendNoticeDialog
          agencies={data?.agencies ?? []}
          trigger={<Button variant="outline"><Megaphone className="h-4 w-4 mr-2" /> Broadcast notice</Button>}
        />
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-8" />
          </div>
          <div className="w-40">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <label className="text-xs text-muted-foreground">Plan</label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {plans.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <label className="text-xs text-muted-foreground">Sort by</label>
            <Select value={sortKey} onValueChange={setSortKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="clients">Most clients</SelectItem>
                <SelectItem value="policies">Most active policies</SelectItem>
                <SelectItem value="revenue">Highest revenue</SelectItem>
                <SelectItem value="onboarded">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">Showing {rows.length} of {data?.agencies?.length ?? 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Agencies</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Onboarded</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead className="text-right">Active policies</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link to="/platform/agencies/$id" params={{ id: a.id }} className="font-medium hover:underline">{a.name}</Link>
                    <div className="text-xs text-muted-foreground">{a.contact_email ?? "—"}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{a.plan}</Badge></TableCell>
                  <TableCell><Badge variant={a.status === "active" ? "default" : "destructive"}>{a.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.onboarded_at ? new Date(a.onboarded_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right">{a.clients}</TableCell>
                  <TableCell className="text-right">{a.activePolicies}</TableCell>
                  <TableCell className="text-right">{fmt(a.revenue)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/platform/agencies/$id" params={{ id: a.id }}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No agencies match.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}