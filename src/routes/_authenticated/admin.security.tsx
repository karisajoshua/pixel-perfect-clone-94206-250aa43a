import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useTenantBrand } from "@/components/tenant-brand-provider";

/** Rewrite the otpauth URI so authenticator apps show the agency + user email. */
function brandOtpauthUri(uri: string, issuer: string, account: string) {
  try {
    const url = new URL(uri);
    url.pathname = `/totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
    url.searchParams.set("issuer", issuer);
    return url.toString();
  } catch {
    return uri;
  }
}

export const Route = createFileRoute("/_authenticated/admin/security")({
  beforeLoad: requireRole(["admin"]),
  component: SecurityPage,
});

function SecurityPage() {
  const brand = useTenantBrand();
  const issuer = brand?.name?.trim() || "Zest Insurance Agency";
  const [account, setAccount] = useState("");
  const [factors, setFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{ id: string; uri: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error(error.message);
    setFactors((data?.all ?? []) as any[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAccount(data.user?.email ?? "account"));
  }, []);

  const beginEnroll = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `${issuer} authenticator`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setEnrolling({
      id: data.id,
      uri: brandOtpauthUri(data.totp.uri, issuer, account || "account"),
      secret: data.totp.secret,
    });
  };

  const verifyEnroll = async () => {
    if (!enrolling) return;
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (chErr) { setBusy(false); return toast.error(chErr.message); }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrolling.id, challengeId: ch.id, code });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication enabled");
    setEnrolling(null);
    setCode("");
    refresh();
  };

  const unenroll = async (id: string) => {
    if (!confirm("Disable this authenticator?")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Factor removed");
    refresh();
  };

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <PageHeader title="Account security" subtitle="Add two-factor authentication for your admin account." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Authenticator app (TOTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : verified.length > 0 ? (
            <div className="space-y-2">
              {verified.map((f) => (
                <div key={f.id} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <div className="font-medium">{f.friendly_name ?? "Authenticator"}</div>
                    <div className="text-xs text-muted-foreground">Added {new Date(f.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Active</Badge>
                    <Button size="sm" variant="ghost" onClick={() => unenroll(f.id)} disabled={busy}><ShieldOff className="h-4 w-4 mr-1" /> Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : enrolling ? (
            <div className="space-y-3">
              <p>
                Scan this QR or enter the secret in your authenticator app (Google Authenticator,
                Authy, 1Password, etc.). It will be saved as{" "}
                <span className="font-medium">{issuer}</span>
                {account ? <> ({account})</> : null}.
              </p>
              <div className="flex flex-col items-center gap-3 p-4 border rounded-md bg-muted/20">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enrolling.uri)}`}
                  alt="TOTP QR code"
                  className="rounded"
                />
                <code className="text-xs break-all">{enrolling.secret}</code>
              </div>
              <p className="text-xs text-muted-foreground">
                If you already added this account before, delete the old entry in your
                authenticator app and scan again so it shows the correct name.
              </p>
              <div>
                <Label>6-digit code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" maxLength={6} />
              </div>
              <div className="flex gap-2">
                <Button onClick={verifyEnroll} disabled={busy || code.length < 6}>Verify & enable</Button>
                <Button variant="ghost" onClick={() => { setEnrolling(null); setCode(""); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground">No second factor is configured. Enabling 2FA significantly improves the security of your admin account.</p>
              <Button onClick={beginEnroll} disabled={busy}>Set up authenticator</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}