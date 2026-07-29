import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeCheck, ShieldAlert, Loader2 } from "lucide-react";

export const Route = createFileRoute("/verify/invoice/$id")({
  component: VerifyInvoice,
  head: () => ({
    meta: [
      { title: "Verify invoice authenticity | Zest Insurance" },
      { name: "description", content: "Scan or open this page to confirm an invoice was genuinely issued by the agency." },
      { property: "og:title", content: "Verify invoice authenticity" },
      { property: "og:description", content: "Confirm an invoice was genuinely issued by the agency." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (n: any) =>
  `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function VerifyInvoice() {
  const { id } = useParams({ from: "/verify/invoice/$id" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["verify-invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verify_invoice" as any, { _id: id });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) ?? null;
    },
    retry: false,
  });

  const balance = data ? Number(data.total) - Number(data.amount_paid || 0) : 0;

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <h1 className="text-center text-xl font-semibold text-foreground">Invoice verification</h1>

        <Card className="overflow-hidden">
          {isLoading ? (
            <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking this invoice…
            </CardContent>
          ) : !data || isError ? (
            <CardContent className="space-y-2 py-10 text-center">
              <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
              <div className="font-semibold text-foreground">No invoice found for this code</div>
              <p className="text-sm text-muted-foreground">
                This QR code does not match any invoice in our records. Please contact the agency before making a payment.
              </p>
            </CardContent>
          ) : (
            <>
              <div className="flex items-center gap-3 bg-primary px-6 py-5 text-primary-foreground">
                <BadgeCheck className="h-8 w-8 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm opacity-90">Verified invoice</div>
                  <div className="truncate text-lg font-bold">{data.agency_name}</div>
                </div>
              </div>
              <CardContent className="space-y-3 py-6 text-sm">
                <Row label="Invoice number" value={data.invoice_no} strong />
                <Row label="Billed to" value={data.client_name ?? "—"} />
                <Row label="Issue date" value={fmtDate(data.issue_date)} />
                <Row label="Due date" value={fmtDate(data.due_date)} />
                <Row label="Total" value={money(data.total)} />
                <Row label="Amount paid" value={money(data.amount_paid)} />
                <Row label="Balance" value={money(balance)} strong />
                <Row label="Status" value={String(data.status ?? "").toUpperCase()} strong />
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Only summary details are shown. Contact the agency for a full copy of the invoice.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? "font-semibold text-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
}