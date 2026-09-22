import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Server, Search, BadgeCheck, PackageSearch } from "lucide-react";
import { requireRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dmvicConnectionStatus } from "@/lib/dmvic/dmvic.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/dmvic")({
  beforeLoad: requireRole(["admin", "manager", "agent"]),
  head: () => ({ meta: [{ title: "DMVIC Motor" }] }),
  component: DmvicPage,
});

function DmvicPage() {
  const statusFn = useServerFn(dmvicConnectionStatus);
  const { data: status, isLoading } = useQuery({
    queryKey: ["dmvic-status"],
    queryFn: () => statusFn(),
    retry: false,
  });

  const { data: orders } = useQuery({ queryKey:["dmvic-orders-summary"], queryFn:async()=>{const {data,error}=await (supabase as any).from("dmvic_certificate_orders").select("id,status,payment_status,selling_price,dmvic_cost,dmvic_certificate_number,created_at").order("created_at",{ascending:false}).limit(100);if(error) throw error;return data??[];}, retry:false });
  const issued=(orders??[]).filter((o:any)=>o.status==="issued");
  const collected=issued.reduce((s:number,o:any)=>s+Number(o.selling_price||0),0);
  const liability=issued.reduce((s:number,o:any)=>s+Number(o.dmvic_cost||0),0);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="DMVIC Motor"
        subtitle="DMVIC-native motor certificate operations for Zest Insurance Agency."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> UAT connection</CardTitle>
          <CardDescription>Secure server-to-server connection through the Zest DMVIC mTLS gateway.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {isLoading ? (
            <Badge variant="outline">Checking…</Badge>
          ) : status?.configured ? (
            <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Configured · UAT</Badge>
          ) : (
            <Badge variant="destructive">Not configured</Badge>
          )}
          <span className="text-sm text-muted-foreground">
            DMVIC credentials and certificate material remain on the gateway and are never exposed in this interface.
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Vehicle & policy check</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Search DMVIC by registration number to review returned vehicle information and policy history before a new certificate request.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BadgeCheck className="h-5 w-5" /> Certificate operations</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Validation and issuance use DMVIC's intermediary APIs directly. Policy alerts remain in manual review and are never auto-approved.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PackageSearch className="h-5 w-5" /> Inventory & status</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Member-company stock is checked before payment and issuance. Insufficient inventory prevents a certificate sale from proceeding.
          </CardContent>
        </Card>
      </div>

      <Card><CardHeader><CardTitle>Certificate business summary</CardTitle><CardDescription>Latest 100 certificate orders visible to this agency.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-4 text-sm"><div className="rounded border p-3"><div className="text-muted-foreground">Orders</div><div className="text-xl font-semibold">{orders?.length??0}</div></div><div className="rounded border p-3"><div className="text-muted-foreground">Issued</div><div className="text-xl font-semibold">{issued.length}</div></div><div className="rounded border p-3"><div className="text-muted-foreground">Collections</div><div className="text-xl font-semibold">KES {collected.toLocaleString()}</div></div><div className="rounded border p-3"><div className="text-muted-foreground">Gross margin</div><div className="text-xl font-semibold">KES {(collected-liability).toLocaleString()}</div></div></div></CardContent></Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration boundary</CardTitle>
          <CardDescription>DMVIC operates independently from every other insurance integration in the application.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          Zest UI → authenticated Zest server functions → DMVIC gateway → DMVIC UAT
        </CardContent>
      </Card>
    </div>
  );
}
