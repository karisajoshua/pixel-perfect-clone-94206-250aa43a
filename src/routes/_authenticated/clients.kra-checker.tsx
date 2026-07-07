import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { checkPinByIdNumber, savePinVerification, type KraIdType } from "@/lib/kra.functions";

export const Route = createFileRoute("/_authenticated/clients/kra-checker")({
  beforeLoad: requireRole(["admin", "manager", "agent"]),
  component: Page,
});

type Result = Awaited<ReturnType<typeof checkPinByIdNumber>>;

function Page() {
  const check = useServerFn(checkPinByIdNumber);
  const save = useServerFn(savePinVerification);
  const [idNumber, setIdNumber] = useState("");
  const [idType, setIdType] = useState<KraIdType>("national_id");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);

  const match = useQuery({
    queryKey: ["kra-client-match", idNumber, result && result.ok ? result.id_number : null],
    enabled: !!(result && result.ok),
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, company_name, client_type, kra_pin, id_number, kra_verified_at")
        .eq("id_number", (result as any).id_number)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const run = async () => {
    if (!idNumber.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await check({ data: { id_number: idNumber.trim(), id_type: idType } });
      setResult(r);
    } catch (e: any) {
      setResult({ ok: false, code: "error", message: e?.message ?? "Lookup failed" });
    } finally {
      setLoading(false);
    }
  };

  const saveToClient = async () => {
    if (!result || !result.ok || !match.data) return;
    setSaving(true);
    try {
      await save({
        data: {
          clientId: match.data.id,
          id_type: result.id_type,
          pin: result.pin,
          taxpayer_name: result.taxpayer_name,
          status: "verified",
        },
      });
      toast.success("Saved to client");
      match.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <PageHeader title="KRA PIN checker" subtitle="Look up a client's KRA PIN using their ID number via KRA GavaConnect." />

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Lookup</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>ID type</Label>
            <Select value={idType} onValueChange={(v) => setIdType(v as KraIdType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="national_id">National ID</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="service_id">Service ID</SelectItem>
                <SelectItem value="alien_id">Alien ID</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ID number</Label>
            <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
          </div>
          <div className="flex items-end">
            <Button onClick={run} disabled={!idNumber.trim() || loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…</> : "Check PIN"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && !result.ok && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
            <div>
              <p className="font-medium">Lookup failed</p>
              <p className="text-muted-foreground">{result.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.ok && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Verified</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">KRA PIN</dt><dd className="font-mono font-medium">{result.pin}</dd>
              <dt className="text-muted-foreground">Taxpayer name</dt><dd className="font-medium">{result.taxpayer_name || "—"}</dd>
              <dt className="text-muted-foreground">Status</dt><dd>{result.status}</dd>
              <dt className="text-muted-foreground">ID</dt><dd>{result.id_number} ({idType.replace("_", " ")})</dd>
            </dl>

            <div className="border-t pt-3">
              {match.isLoading && <p className="text-xs text-muted-foreground">Checking existing clients…</p>}
              {!match.isLoading && match.data && (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">Matches existing client</p>
                    <Link to="/clients/$id" params={{ id: match.data.id }} className="text-primary underline text-xs">
                      {match.data.company_name || match.data.full_name || match.data.id}
                    </Link>
                  </div>
                  <Button size="sm" onClick={saveToClient} disabled={saving}>
                    {saving ? "Saving…" : "Save PIN to client"}
                  </Button>
                </div>
              )}
              {!match.isLoading && !match.data && (
                <p className="text-sm text-muted-foreground">
                  No existing client with this ID number. You can create a new client and this PIN will be pre-filled from the ID.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}