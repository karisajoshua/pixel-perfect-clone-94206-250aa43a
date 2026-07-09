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
  registerIpen,
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
  ipenHealthCheck,
} from "@/lib/ipen/common.functions";

export const Route = createFileRoute("/_authenticated/admin/ipen")({
  beforeLoad: requireRole(["admin", "manager", "agent"]),
  head: () => ({ meta: [{ title: "IPEN integration" }] }),
  component: IpenAdminPage,
  errorComponent: IpenRouteError,
});

function IpenRouteError({ error, reset }: { error: Error; reset: () => void }) {
  const isDev =
    typeof window !== "undefined" &&
    /localhost|lovableproject\.com|-dev\.lovable\.app/.test(window.location.hostname);
  return (
    <div className="space-y-4 p-4 md:p-8">
      <PageHeader title="IPEN integration" subtitle="This panel hit an error while loading." />
      <Card>
        <CardHeader>
          <CardTitle>Couldn't load the IPEN panel</CardTitle>
          <CardDescription>{error?.message ?? "Unknown error"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => reset()}>Try again</Button>
          {isDev && error?.stack && (
            <details className="rounded-md border border-border bg-muted/40 p-3 text-xs">
              <summary className="cursor-pointer font-medium">Stack (dev only)</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-muted-foreground">
                {error.stack}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function IpenAdminPage() {
  const qc = useQueryClient();
  const statusFn = useServerFn(ipenStatus);
  const connectFn = useServerFn(connectIpen);
  const verifyFn = useServerFn(verifyIpenMfa);
  const resendFn = useServerFn(resendIpenMfa);
  const disconnectFn = useServerFn(disconnectIpen);
  const registerFn = useServerFn(registerIpen);
  const testConnectionFn = useServerFn(listCountries);
  const healthFn = useServerFn(ipenHealthCheck);
  const { data: health } = useQuery({
    queryKey: ["ipen-health"],
    queryFn: () => healthFn(),
    retry: false,
    refetchInterval: 60_000,
  });

  const { data: status, isLoading } = useQuery({
    queryKey: ["ipen-status"],
    queryFn: () => statusFn(),
    retry: false,
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "register">("signin");
  const [reg, setReg] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    idNumber: "",
    identificationTypeId: "1",
    registerAs: "Individual",
    companyName: "",
    password: "",
    confirmPassword: "",
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["ipen-status"] });

  const doConnect = async () => {
    setBusy(true);
    try {
      const r = await connectFn({ data: { email, password } });
      toast.success(
        r.mfaRequired
          ? "A new Ecobank OTP was sent. Use the newest code below."
          : "IPEN sign-in submitted. If you received an Ecobank OTP, enter it below.",
      );
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

  const doTestConnection = async () => {
    setBusy(true);
    try {
      const result = await testConnectionFn();
      const rows = Array.isArray(result) ? result : (result?.data ?? result?.items ?? []);
      toast.success(`IPEN live connection working${Array.isArray(rows) ? ` (${rows.length} countries)` : ""}`);
    } catch (e: any) {
      toast.error(e.message ?? "IPEN connection test failed");
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    if (reg.password !== reg.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const r = await registerFn({
        data: {
          firstName: reg.firstName,
          middleName: reg.middleName || undefined,
          lastName: reg.lastName,
          email: reg.email,
          phoneNumber: reg.phoneNumber,
          idNumber: reg.idNumber,
          identificationTypeId: Number(reg.identificationTypeId),
          registerAs: reg.registerAs,
          companyName: reg.companyName || undefined,
          password: reg.password,
          confirmPassword: reg.confirmPassword,
        },
      });
      toast.success(
        r.mfaRequired
          ? "A new Ecobank OTP was sent. Use the newest code below."
          : "IPEN registration submitted. If you received an Ecobank OTP, enter it below.",
      );
      setEmail(reg.email);
      setReg({
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        idNumber: "",
        identificationTypeId: "1",
        registerAs: "Individual",
        companyName: "",
        password: "",
        confirmPassword: "",
      });
      if (!r.connected && !r.mfaRequired) setAuthTab("signin");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.connected;
  const mfaPending = status?.mfa_required;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="IPEN integration"
        subtitle="Connect your Africa Bima / IPEN account to fetch live quotes, policies, claims, and process M-Pesa payments."
      />

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">IPEN service:</span>
        {health ? (
          health.ok ? (
            <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Online</Badge>
          ) : (
            <Badge variant="destructive">Offline ({health.status ?? "?"})</Badge>
          )
        ) : (
          <Badge variant="outline">Checking…</Badge>
        )}
      </div>

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
        <CardContent className="space-y-6">
          <OtpBox
            code={code}
            setCode={setCode}
            onVerify={doVerify}
            busy={busy || isLoading}
            showResend={Boolean(mfaPending)}
            onResend={async () => {
              try {
                await resendFn();
                toast.success("Code re-sent");
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
          />

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading status…</div>
          ) : connected ? (
            <div className="space-y-4">
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
                <Button variant="outline" size="sm" onClick={doTestConnection} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test connection
                </Button>
              </div>
            </div>
          ) : (
            <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "signin" | "register")}>
              <TabsList>
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-4">
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
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="mr-2 h-4 w-4" />
                    )}
                    Connect
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="register" className="mt-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-fn">First name</Label>
                    <Input
                      id="reg-fn"
                      value={reg.firstName}
                      onChange={(e) => setReg({ ...reg, firstName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-mn">Middle name</Label>
                    <Input
                      id="reg-mn"
                      value={reg.middleName}
                      onChange={(e) => setReg({ ...reg, middleName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-ln">Last name</Label>
                    <Input
                      id="reg-ln"
                      value={reg.lastName}
                      onChange={(e) => setReg({ ...reg, lastName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-em">Email</Label>
                    <Input
                      id="reg-em"
                      type="email"
                      autoComplete="off"
                      value={reg.email}
                      onChange={(e) => setReg({ ...reg, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-ph">Phone number</Label>
                    <Input
                      id="reg-ph"
                      value={reg.phoneNumber}
                      onChange={(e) => setReg({ ...reg, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-id">ID number</Label>
                    <Input
                      id="reg-id"
                      value={reg.idNumber}
                      onChange={(e) => setReg({ ...reg, idNumber: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-idtype">ID type</Label>
                    <select
                      id="reg-idtype"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={reg.identificationTypeId}
                      onChange={(e) => setReg({ ...reg, identificationTypeId: e.target.value })}
                    >
                      <option value="1">National ID</option>
                      <option value="2">Passport</option>
                      <option value="3">Alien ID</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-as">Register as</Label>
                    <select
                      id="reg-as"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={reg.registerAs}
                      onChange={(e) => setReg({ ...reg, registerAs: e.target.value })}
                    >
                      <option value="Individual">Individual</option>
                      <option value="Corporate">Corporate</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5 sm:col-span-3">
                    <Label htmlFor="reg-co">Company (optional)</Label>
                    <Input
                      id="reg-co"
                      value={reg.companyName}
                      onChange={(e) => setReg({ ...reg, companyName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-pw">Password</Label>
                    <Input
                      id="reg-pw"
                      type="password"
                      autoComplete="new-password"
                      value={reg.password}
                      onChange={(e) => setReg({ ...reg, password: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reg-pw2">Confirm password</Label>
                    <Input
                      id="reg-pw2"
                      type="password"
                      autoComplete="new-password"
                      value={reg.confirmPassword}
                      onChange={(e) => setReg({ ...reg, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    onClick={doRegister}
                    disabled={
                      busy ||
                      !reg.firstName ||
                      !reg.lastName ||
                      !reg.email ||
                      !reg.phoneNumber ||
                      !reg.idNumber ||
                      !reg.password ||
                      !reg.confirmPassword
                    }
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="mr-2 h-4 w-4" />
                    )}
                    Create IPEN account
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
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

  const raw = Array.isArray(data) ? data : (data?.data ?? data?.items ?? data?.result ?? data?.results ?? []);
  const rows: any[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
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

type OtpBoxProps = {
  code: string;
  setCode: (v: string) => void;
  onVerify: () => void;
  onResend: () => void;
  busy: boolean;
  showResend: boolean;
};

function OtpBox({ code, setCode, onVerify, onResend, busy, showResend }: OtpBoxProps) {
  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm">Paste the newest code from the Ecobank / IPEN SMS or email.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ipen-otp">Ecobank OTP</Label>
          <Input
            id="ipen-otp"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-48"
            autoComplete="one-time-code"
            inputMode="numeric"
          />
        </div>
        <Button onClick={onVerify} disabled={busy || !code}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify
        </Button>
        {showResend && (
          <Button variant="ghost" size="sm" onClick={onResend} disabled={busy}>
            Resend code
          </Button>
        )}
      </div>
    </div>
  );
}