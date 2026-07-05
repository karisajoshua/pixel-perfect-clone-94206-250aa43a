import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformOverview } from "@/lib/platform.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_platform/platform/agencies")({
  head: () => ({ meta: [{ title: "Agencies — Platform" }] }),
  component: AgenciesList,
});

function AgenciesList() {
  const fetchFn = useServerFn(getPlatformOverview);
  const { data } = useQuery({ queryKey: ["platform-overview"], queryFn: () => fetchFn() });
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All agencies</h1>
        <p className="text-sm text-muted-foreground">Click an agency to drill in.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{data?.agencies?.length ?? 0} agencies</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead className="text-right">Active policies</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.agencies ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell><Link to="/platform/agencies/$id" params={{ id: a.id }} className="font-medium hover:underline">{a.name}</Link></TableCell>
                  <TableCell><Badge variant="outline">{a.plan}</Badge></TableCell>
                  <TableCell><Badge variant={a.status === "active" ? "default" : "destructive"}>{a.status}</Badge></TableCell>
                  <TableCell className="text-right">{a.clients}</TableCell>
                  <TableCell className="text-right">{a.activePolicies}</TableCell>
                  <TableCell className="text-right">{fmt(a.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}