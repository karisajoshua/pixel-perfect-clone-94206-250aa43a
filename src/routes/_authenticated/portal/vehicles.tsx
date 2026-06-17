import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyVehicles } from "@/lib/portal.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/portal/vehicles")({ component: Page });

function Page() {
  const fn = useServerFn(listMyVehicles);
  const { data, isLoading } = useQuery({ queryKey: ["portal-vehicles"], queryFn: () => fn(), staleTime: 60_000 });
  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">My Vehicles</h1>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-8 text-muted-foreground">Loading…</div> :
          !data || data.length === 0 ? <div className="p-8 text-center text-muted-foreground">No vehicles on file.</div> :
          <Table>
            <TableHeader><TableRow>
              <TableHead>Reg. No.</TableHead><TableHead>Make / Model</TableHead><TableHead>Year</TableHead><TableHead>Active policies</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.registration_no}</TableCell>
                <TableCell>{`${v.make ?? ""} ${v.model ?? ""}`.trim() || "—"}</TableCell>
                <TableCell>{v.year ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(v.policies ?? []).filter((p: any) => p.status === "active").map((p: any) => p.policy_no).join(", ") || "—"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        }
      </CardContent></Card>
    </div>
  );
}