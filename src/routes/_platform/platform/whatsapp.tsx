import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWhatsAppPlatformHealth } from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/_platform/platform/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp health — Platform" },
      { name: "description", content: "Platform-wide WhatsApp channel health, send volume and webhook processing." },
      { property: "og:title", content: "WhatsApp health — Platform" },
      { property: "og:description", content: "Platform-wide WhatsApp channel health, send volume and webhook processing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlatformWhatsApp,
});

function PlatformWhatsApp() {
  const fn = useServerFn(getWhatsAppPlatformHealth);
  const q = useQuery({ queryKey: ["platform", "whatsapp"], queryFn: () => fn(), refetchInterval: 30_000 });
  const d = q.data;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp health</h1>
        <p className="text-sm text-muted-foreground">Channel status per agency, seven-day volume and webhook processing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Connected numbers" value={d?.connected ?? 0} />
        <Stat label="Messages (7 days)" value={Object.values(d?.volume_7d ?? {}).reduce((a: number, b: any) => a + Number(b), 0)} />
        <Stat label="Unprocessed webhooks" value={d?.webhook_unprocessed ?? 0} />
      </div>

      <Card className="overflow-x-auto">
        <div className="px-4 py-3 border-b font-medium">Agency channels</div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="px-3 py-2">Agency</th><th className="px-3 py-2">Number</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Checked</th></tr></thead>
          <tbody>
            {(d?.channels ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No agency has connected WhatsApp yet.</td></tr>}
            {(d?.channels ?? []).map((c: any) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-3 py-2">{c.tenant_name ?? c.tenant_id}</td>
                <td className="px-3 py-2">{c.display_phone_number ?? "—"}</td>
                <td className="px-3 py-2">{c.mode}</td>
                <td className="px-3 py-2"><Badge variant={c.status === "connected" ? "default" : c.status === "error" ? "destructive" : "secondary"}>{c.status}</Badge></td>
                <td className="px-3 py-2 whitespace-nowrap">{c.last_verified_at ? format(new Date(c.last_verified_at), "dd MMM HH:mm") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto">
        <div className="px-4 py-3 border-b font-medium">Recent failures</div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Agency</th><th className="px-3 py-2">Reason</th></tr></thead>
          <tbody>
            {(d?.recent_failures ?? []).length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No failures.</td></tr>}
            {(d?.recent_failures ?? []).map((f: any) => (
              <tr key={f.id} className="border-b last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">{format(new Date(f.created_at), "dd MMM HH:mm")}</td>
                <td className="px-3 py-2">{f.tenant_id}</td>
                <td className="px-3 py-2">{f.error_code ? `${f.error_code} — ` : ""}{f.error ?? "unknown"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Card>
  );
}
