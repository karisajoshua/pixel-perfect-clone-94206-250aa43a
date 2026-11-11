import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, Maximize2, Minimize2, RefreshCw, ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/insurer-portals")({
  beforeLoad: requireRole(["admin", "manager", "agent"]),
  component: InsurerPortals,
});

const portals = [
  { id: "cic", name: "CIC", url: "https://ke.cicinsurancegroup.com/client-portals/", note: "Official portal directory; select broker/agent access." },
  { id: "old-mutual", name: "Old Mutual", url: "https://selfservice.oldmutual.co.ke/", note: "Self-service portal; broker access may require another URL." },
  { id: "pacis", name: "Pacis", url: "https://selfservice.pacisinsurance.com/", note: "Self-service and agent login." },
  { id: "pioneer", name: "Pioneer", url: "https://agents.pioneerassurance.co.ke/login", note: "Agent login." },
  { id: "britam", name: "Britam", url: "https://ke.britam.com/", note: "Official website placeholder; confirm the exact agent portal URL." },
  { id: "icea-lion", name: "ICEA LION", url: "https://www.icealion.com/", note: "Official website placeholder; confirm the exact partner portal URL." },
  { id: "jubilee-medical", name: "Jubilee Medical", url: "https://jubileeinsurance.com/ke/", note: "Official website placeholder; medical servicing is separate from DMVIC motor certificates." },
] as const;

function InsurerPortals() {
  const [selected, setSelected] = useState<string>(portals[0].id);
  const [frameKey, setFrameKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const portal = portals.find((item) => item.id === selected) ?? portals[0];

  const selectPortal = (id: string) => {
    setSelected(id);
    setLoaded(false);
    setFrameKey((key) => key + 1);
  };

  return (
    <div className="p-4 md:p-8 space-y-5">
      <PageHeader title="Insurer portals" subtitle="Work with insurer websites from your Zest workspace where embedding is permitted." />
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground flex gap-3 items-start">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <p>Insurer sites control whether they can be displayed in an embedded frame. A blank or blocked view usually means the insurer disallows framing; use Open portal instead. Zest does not capture insurer login credentials or bypass their security controls.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose insurer">
        {portals.map((item) => (
          <Button key={item.id} size="sm" variant={item.id === portal.id ? "default" : "outline"} aria-pressed={item.id === portal.id} onClick={() => selectPortal(item.id)}>
            {item.name}
          </Button>
        ))}
      </div>
      <section className={expanded ? "fixed inset-2 z-50 flex flex-col rounded-xl border bg-background p-3 shadow-2xl" : "rounded-xl border bg-card overflow-hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div className="min-w-0">
            <h2 className="font-semibold">{portal.name}</h2>
            <p className="text-xs text-muted-foreground">{portal.note}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { setLoaded(false); setFrameKey((key) => key + 1); }}><RefreshCw className="mr-2 h-4 w-4" />Reload</Button>
            <Button size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}{expanded ? "Exit full view" : "Expand"}</Button>
            <Button size="sm" asChild><a href={portal.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open portal</a></Button>
          </div>
        </div>
        <div className={expanded ? "flex-1 min-h-0" : "h-[68vh] min-h-[420px]"}>
          <iframe
            key={portal.id + "-" + frameKey}
            title={portal.name + " insurer portal"}
            src={portal.url}
            className="h-full w-full bg-white"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoaded(true)}
          />
        </div>
        <div className="border-t p-3 text-xs text-muted-foreground">
          {loaded ? "The browser finished a frame navigation. This does not confirm that the insurer permits embedding or that its login works." : "Loading portal…"} If the content is blocked, select Open portal. No insurer API connection or certificate synchronisation is enabled here.
        </div>
      </section>
    </div>
  );
}
