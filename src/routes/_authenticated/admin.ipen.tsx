import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { requireRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plug, PlugZap, ShieldCheck } from "lucide-react";
import {
  connectIpen,
  disconnectIpen,
  ipenStatus,
  resendIpenMfa,
  verifyIpenMfa,
} from "@/lib/ipen/auth.functions";
import {
  listCountries,
  listGenders,
  listIdentificationDocuments,
  listMotorTypes,
  listRelationships,
  listRiskClassCategories,
  listVehicleMakes,
  listVehicleModels,
  listCoverOptions,
} from "@/lib/ipen/common.functions";

export const Route = createFileRoute("/_authenticated/admin/ipen")({
  beforeLoad: requireRole(["admin", "manager", "agent"]),
  head: () => ({ meta: [{ title: "IPEN integration" }] }),
  component: IpenAdminPage,
});

function IpenAdminPage() {
  const qc = useQueryClient();
  const statusFn = useServerFn(ipenStatus);
  const connectFn = useServerFn(connectIpen);
  const verifyFn = useServerFn(verifyIpenMfa);
  const resendFn = useServerFn(resendIpenMfa);
  const disconnectFn = useServerFn(disconnectIpen);

  const { data: status, isLoading } = useQuery({
    queryKey: ["ipen-status"],
    queryFn: () => statusFn(),
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["ipen-status"] });

  const doConnect = async () => {
    setBusy(true);
    try {
      const r = await connectFn({ data: { email, password } });
      toast.success(r.mfaRequired ? "Enter the verification code sent to you" : "IPEN connected");
      setPassword("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    setBusy(true);
    try {
      await verifyFn({ data: { code } });
      toast.success("IPEN connected");
      setCode("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doDisconnect = async () => {
    if (!confirm("Disconnect your IPEN account?")) return;
    setBusy(true);
    try {
      await disconnectFn();
      toast.success("Disconnected");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.connected;
  const mfaPending = status?.mfa_required && !connected;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="IPEN integration"
        description="Connect your Africa Bima / IPEN account to fetch live quotes, policies, claims, and process M-Pesa payments."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            Connection
          </CardTitle>
          <CardDescription>
            Credentials are stored per user and only your access token is used when you trigger IPEN
            actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading status…</div>
          ) : connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Connected
              </Badge>
              <span className="text-sm">{status?.ipen_email}</span>
              {status?.last_login_at && (
                <span className="text-xs text-muted-foreground">
                  since {new Date(status.last_login_at).toLocaleString()}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={doDisconnect} disabled={busy}>
                Disconnect
              </Button>
            </div>
          ) : mfaPending ? (
            <div className="space-y-3">
              <p className="text-sm">
                A verification code was sent to <strong>{status?.ipen_email}</strong>. Enter it below
                to finish signing in.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="mfa">Verification code</Label>
                  <Input
                    id="mfa"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Button onClick={doVerify} disabled={busy || !code}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await resendFn();
                      toast.success("Code re-sent");
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                  disabled={busy}
                >
                  Resend
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="ipen-email">IPEN email</Label>
                <Input
                  id="ipen-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ipen-pw">IPEN password</Label>
                <Input
                  id="ipen-pw"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button onClick={doConnect} disabled={busy || !email || !password}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                Connect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {connected && <ReferenceExplorer />}
    </div>
  );
}

function ReferenceExplorer() {
  const tabs = [
    { key: "countries", label: "Countries", fn: listCountries },
    { key: "genders", label: "Genders", fn: listGenders },
    { key: "id-docs", label: "ID documents", fn: listIdentificationDocuments },
    { key: "relationships", label: "Relationships", fn: listRelationships },
    { key: "risk-categories", label: "Risk categories", fn: listRiskClassCategories },
    { key: "motor-types", label: "Motor types", fn: listMotorTypes },
    { key: "vehicle-makes", label: "Vehicle makes", fn: listVehicleMakes },
    { key: "vehicle-models", label: "Vehicle models", fn: listVehicleModels },
    { key: "cover-options", label: "Cover options", fn: listCoverOptions },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reference data</CardTitle>
        <CardDescription>
          Live lookups from the IPEN sandbox. Use this to confirm your connection works and to inspect
          the values available for quoting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={tabs[0].key} className="w-full">
          <TabsList className="flex flex-wrap h-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              <RefList fn={t.fn} cacheKey={t.key} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RefList({ fn, cacheKey }: { fn: any; cacheKey: string }) {
  const call = useServerFn(fn);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ipen-ref", cacheKey],
    queryFn: () => call(),
    retry: false,
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error)
    return (
      <div className="text-sm text-destructive">
        {(error as Error).message ?? "Failed to load"}
      </div>
    );

  const rows: any[] = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["ipen-ref", cacheKey] })}
        >
          Refresh
        </Button>
      </div>
      <div className="max-h-[420px] overflow-auto rounded border">
        <pre className="p-3 text-xs">{JSON.stringify(rows.slice(0, 200), null, 2)}</pre>
      </div>
    </div>
  );
}