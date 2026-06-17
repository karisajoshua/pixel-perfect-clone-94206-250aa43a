import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyInvoices } from "@/lib/portal.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/portal/invoices")({ component: Page });

function Page() {
  const fn = useServerFn(listMyInvoices);
  const { data, isLoading } = useQuery({ queryKey: ["portal-invoices"], queryFn: () => fn(), staleTime: 60_000 });
  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">My Invoices</h1>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-8 text-muted-foreground">Loading…</div> :
          !data || data.length === 0 ? <div className="p-8 text-center text-muted-foreground">No invoices yet.</div> :
          <Table>
            <TableHeader><TableRow>
              <TableHead>Invoice</TableHead><TableHead>Policy</TableHead><TableHead>Issued</TableHead><TableHead>Due</TableHead><TableHead>Total</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.map((i: any) => {
              const bal = Number(i.total) - Number(i.amount_paid || 0);
              return (
                <TableRow key={i.id}>
                  <TableCell><Link to="/portal/invoices/$id" params={{ id: i.id }} className="text-primary font-medium">{i.invoice_no}</Link></TableCell>
                  <TableCell>{i.policies?.policy_no ?? "—"}</TableCell>
                  <TableCell>{i.issue_date}</TableCell>
                  <TableCell>{i.due_date}</TableCell>
                  <TableCell>{Number(i.total).toLocaleString()}</TableCell>
                  <TableCell className={bal > 0 ? "text-amber-600 font-medium" : ""}>{bal.toLocaleString()}</TableCell>
                  <TableCell><Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        }
      </CardContent></Card>
    </div>
  );
}