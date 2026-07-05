import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformOverview } from "@/lib/platform.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileText, DollarSign, ScrollText, Megaphone, Sparkles } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_platform/platform/")({
  head: () => ({ meta: [{ title: "Platform overview" }] }),
  component: PlatformOverview,
});

function PlatformOverview() {
  const fetchFn = useServerFn(getPlatformOverview);
  const { data } = useQuery({ queryKey: ["platform-overview"], queryFn: () => fetchFn() });
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
  const t = data?.totals;

  const tiles = [
    { label: "Agencies", value: t?.agencies ?? "—", icon: Building2 },
    { label: "Total clients", value: t?.clients ?? "—", icon: Users },
    { label: "Active policies", value: t?.activePolicies ?? "—", icon: FileText },
    { label: "Open claims", value: t?.openClaims ?? "—", icon: ScrollText },
    { label: "Total revenue", value: t ? fmt(t.revenue) : "—", icon: DollarSign },
    { label: "New agencies (30d)", value: t?.newAgenciesLast30 ?? "—", icon: Sparkles },
    { label: "Notices sent (30d)", value: t?.noticesLast30 ?? "—", icon: Megaphone },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">Performance across every agency on the platform.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{tile.label}</CardTitle>
              <tile.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{tile.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Agencies</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead className="text-right">Active policies</TableHead>
                <TableHead className="text-right">Open claims</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.agencies ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link to="/platform/agencies/$id" params={{ id: a.id }} className="font-medium hover:underline">{a.name}</Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" ? "default" : "destructive"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{a.clients}</TableCell>
                  <TableCell className="text-right">{a.activePolicies}</TableCell>
                  <TableCell className="text-right">{a.openClaims}</TableCell>
                  <TableCell className="text-right">{fmt(a.revenue)}</TableCell>
                </TableRow>
              ))}
              {(!data?.agencies || data.agencies.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No agencies yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}