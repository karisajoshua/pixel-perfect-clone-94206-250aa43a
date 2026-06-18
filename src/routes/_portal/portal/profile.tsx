import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPortalOverview } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_portal/portal/profile")({ component: Page });

function Page() {
  const fn = useServerFn(getPortalOverview);
  const { data, isLoading } = useQuery({ queryKey: ["portal-overview"], queryFn: () => fn(), staleTime: 60_000 });
  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!data) return null;
  const c: any = data.client;
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">My Profile</h1>
      <Card><CardHeader><CardTitle className="text-base">Personal details</CardTitle></CardHeader><CardContent className="text-sm grid sm:grid-cols-2 gap-3">
        <Row k="Full name" v={c.full_name} />
        <Row k="Email" v={c.email ?? "—"} />
        <Row k="Phone" v={c.phone ?? "—"} />
        <Row k="Alt. phone" v={c.alt_phone ?? "—"} />
        <Row k="ID number" v={c.id_number ?? "—"} />
        <Row k="KRA PIN" v={c.kra_pin ?? "—"} />
        <Row k="Address" v={c.address ?? "—"} />
        <Row k="City" v={c.city ?? "—"} />
        <Row k="Branch" v={c.branches?.name ?? "—"} />
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">To update your details, please contact your agent.</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div><div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>;
}