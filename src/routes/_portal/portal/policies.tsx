import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyPolicies } from "@/lib/portal.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_portal/portal/policies")({ component: Page });

function Page() {
  const fn = useServerFn(listMyPolicies);
  const { data, isLoading } = useQuery({ queryKey: ["portal-policies"], queryFn: () => fn(), staleTime: 60_000 });
  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">My Policies</h1>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-muted-foreground">Loading…</div>
          ) : !data || data.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No policies yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy</TableHead>
                  <TableHead>Insurer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p: any) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell><Link to="/portal/policies/$id" params={{ id: p.id }} className="text-primary font-medium">{p.policy_no}</Link></TableCell>
                    <TableCell>{p.insurers?.name ?? "—"}</TableCell>
                    <TableCell>{p.vehicles ? `${p.vehicles.registration_no} · ${p.vehicles.make ?? ""} ${p.vehicles.model ?? ""}`.trim() : "—"}</TableCell>
                    <TableCell className="text-xs">{p.start_date} → {p.end_date}</TableCell>
                    <TableCell>{p.premium_gross ? Number(p.premium_gross).toLocaleString() : "—"}</TableCell>
                    <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}