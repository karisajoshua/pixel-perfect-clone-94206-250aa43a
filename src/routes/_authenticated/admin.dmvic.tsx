import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Server, FileSearch, BadgeCheck, PackageSearch } from "lucide-react";
import { requireRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dmvicConnectionStatus } from "@/lib/dmvic/dmvic.functions";

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
          <CardHeader><CardTitle className="flex items-center gap-2"><FileSearch className="h-5 w-5" /> Certificate preview</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Build and preview DMVIC certificate requests before issuance. Preview does not consume certificate stock.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BadgeCheck className="h-5 w-5" /> Certificate operations</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Validation, issuance and policy-alert review will use DMVIC's intermediary APIs directly.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PackageSearch className="h-5 w-5" /> Inventory & status</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            DMVIC stock, certificate verification and status functions will be exposed here as their UAT contracts are verified.
          </CardContent>
        </Card>
      </div>

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
