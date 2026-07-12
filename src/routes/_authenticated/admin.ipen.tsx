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
  listCustomerVehicles,
} from "@/lib/ipen/common.functions";
import { listPolicies } from "@/lib/ipen/policies.functions";
import { listIpenClaims } from "@/lib/ipen/claims.functions";
import { getIpenProfile } from "@/lib/ipen/profile.functions";
import { getIpenPortalDashboard } from "@/lib/ipen/portal.functions";
import { ipenAssistantChat } from "@/lib/ipen/assistant.functions";
import { initiateMpesaExpressDirect } from "@/lib/ipen/payments.functions";
import { ipenOcrExtract } from "@/lib/ipen/ocr.functions";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@tanstack/react-router";

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
          ? r.otpSent
            ? "OTP sent to your IPEN email/phone. Check your inbox and SMS, then enter it below."
            : "IPEN wants an OTP but didn't confirm delivery. Click Resend OTP below."
          : "IPEN sign-in submitted.",
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
    if (!confirm("Disconnect the agency IPEN connection for all staff?")) return;
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
      if (result?.error) {
        toast.error(result.error);
        return;
      }
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
        subtitle="Connect the agency Africa Bima / IPEN account once so staff can fetch live quotes, policies, claims, and process M-Pesa payments."
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
            One agency IPEN connection is shared securely by admins, managers, and agents in the same agency.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status?.canManage && (
            <OtpBox
              code={code}
              setCode={setCode}
              onVerify={doVerify}
              busy={busy || isLoading}
              showResend={true}
              onResend={async () => {
                try {
                  await resendFn();
                  toast.success("Code re-sent");
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            />
          )}

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading status…</div>
          ) : connected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Agency connected
                </Badge>
                <span className="text-sm">{status?.ipen_email}</span>
                {status?.scope === "agency" && <Badge variant="outline">Shared with staff</Badge>}
                {status?.last_login_at && (
                  <span className="text-xs text-muted-foreground">
                    since {new Date(status.last_login_at).toLocaleString()}
                  </span>
                )}
                {status?.canManage && (
                  <Button variant="outline" size="sm" onClick={doDisconnect} disabled={busy}>
                    Disconnect
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={doTestConnection} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test connection
                </Button>
              </div>
            </div>
          ) : !status?.canManage ? (
            <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              Agency IPEN is not connected yet. Ask an admin or manager to connect it once, then all staff will be able to use IPEN services automatically.
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
      {connected && <ServicesExplorer />}
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
      {data?.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {data.error}
        </div>
      )}
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
            Resend OTP
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Didn't get the code? Check spam, then click Resend OTP.
      </p>
    </div>
  );
}

function JsonPanel({ fn, cacheKey, label }: { fn: any; cacheKey: string; label: string }) {
  const call = useServerFn(fn);
  const qc = useQueryClient();
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["ipen-svc", cacheKey],
    queryFn: () => call(),
    retry: false,
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `Live ${label}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => qc.invalidateQueries({ queryKey: ["ipen-svc", cacheKey] })}
        >
          {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Refresh
        </Button>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message ?? "Failed to load"}
        </div>
      )}
      {(data as any)?.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {(data as any).error}
        </div>
      )}
      <div className="max-h-[420px] overflow-auto rounded border">
        <pre className="p-3 text-xs">{JSON.stringify(data ?? {}, null, 2)}</pre>
      </div>
    </div>
  );
}

function PaymentTab() {
  const call = useServerFn(initiateMpesaExpressDirect);
  const [proposalId, setProposalId] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const submit = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await call({ data: { proposalId, phoneNumber: phone, amount } });
      setResult(r);
      toast.success("STK push submitted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Trigger an M-Pesa STK push against IPEN. Use a real proposal ID from an IPEN quote.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label>Proposal ID</Label>
          <Input value={proposalId} onChange={(e) => setProposalId(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Phone (2547…)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Amount (KES)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <Button onClick={submit} disabled={busy || !proposalId || !phone || !amount}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send STK push
      </Button>
      {result && (
        <div className="max-h-[300px] overflow-auto rounded border">
          <pre className="p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function OcrTab() {
  const call = useServerFn(ipenOcrExtract);
  const [docType, setDocType] = useState("national-id");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const onFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const r = await call({
        data: {
          documentType: docType,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileBase64: b64,
        },
      });
      setResult(r);
      toast.success("OCR complete");
    } catch (e: any) {
      toast.error(e.message ?? "OCR failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Upload an ID, logbook, or KRA PIN certificate and IPEN extracts the fields.
      </p>
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <div className="grid gap-1.5">
          <Label>Document type</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            <option value="national-id">National ID</option>
            <option value="passport">Passport</option>
            <option value="logbook">Logbook</option>
            <option value="kra-pin">KRA PIN certificate</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>File</Label>
          <Input
            type="file"
            accept="image/*,application/pdf"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </div>
      </div>
      {busy && <div className="text-sm text-muted-foreground">Extracting…</div>}
      {result && (
        <div className="max-h-[420px] overflow-auto rounded border">
          <pre className="p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function AssistantTab() {
  const call = useServerFn(ipenAssistantChat);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<any>(null);
  const ask = async () => {
    setBusy(true);
    setReply(null);
    try {
      const r = await call({ data: { message: msg } });
      setReply(r);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Ask the IPEN assistant. For a full chat experience, open the{" "}
        <Link to="/assistant" className="underline">Assistant page</Link>.
      </p>
      <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. What motor covers do you offer?" />
      <Button onClick={ask} disabled={busy || !msg}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Ask
      </Button>
      {reply && (
        <div className="max-h-[420px] overflow-auto rounded border">
          <pre className="p-3 text-xs">{JSON.stringify(reply, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function ServicesExplorer() {
  const tabs = [
    { key: "policies", label: "Policies", node: <JsonPanel fn={listPolicies} cacheKey="policies" label="policies" /> },
    { key: "claims", label: "Claims", node: <JsonPanel fn={listIpenClaims} cacheKey="claims" label="claims" /> },
    { key: "customer-vehicles", label: "Customer vehicles", node: <JsonPanel fn={listCustomerVehicles} cacheKey="customer-vehicles" label="vehicles" /> },
    { key: "profile", label: "Profile", node: <JsonPanel fn={getIpenProfile} cacheKey="profile" label="profile" /> },
    { key: "portal", label: "Portal dashboard", node: <JsonPanel fn={getIpenPortalDashboard} cacheKey="portal" label="portal" /> },
    { key: "payments", label: "M-Pesa payment", node: <PaymentTab /> },
    { key: "ocr", label: "OCR", node: <OcrTab /> },
    { key: "assistant", label: "Assistant", node: <AssistantTab /> },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>IPEN services</CardTitle>
        <CardDescription>
          Try every connected IPEN endpoint from one place: policies, claims, profile,
          portal, M-Pesa STK push, OCR extraction, and the assistant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={tabs[0].key} className="w-full">
          <TabsList className="flex flex-wrap h-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              {t.node}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}