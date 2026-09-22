import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPinned } from "lucide-react";
import { KenyaInsuranceMap } from "@/components/maps/kenya-insurance-map";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/geographic-intelligence")({
  component: GeographicIntelligencePage,
});

const metrics = ["Policies", "Premium", "Claims", "Claim value", "Loss ratio", "Customers", "Renewals", "Expired"];

function GeographicIntelligencePage() {
  const [metric, setMetric] = useState("Policies");
  const [product, setProduct] = useState("All products");
  const [period, setPeriod] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState("Active");
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Geographic intelligence" subtitle="Explore portfolio distribution, claims risk, sales performance and renewal opportunity across Kenya." />

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label="Metric" value={metric} onChange={setMetric} options={metrics} />
          <Filter label="Product" value={product} onChange={setProduct} options={["All products","Motor","Medical","Property","Other"]} />
          <Filter label="Period" value={period} onChange={setPeriod} options={[String(new Date().getFullYear()),String(new Date().getFullYear()-1)]} />
          <Filter label="Status" value={status} onChange={setStatus} options={["Active","All","Expired"]} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card><CardContent className="p-0"><KenyaInsuranceMap values={[]} onCountyClick={setSelectedCounty} /></CardContent></Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-primary" /><h2 className="font-semibold">{selectedCounty ?? "County details"}</h2></div>
            {selectedCounty ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted-foreground">The county boundary is live. Insurance figures will appear here once existing Zest records are normalized to county geography.</p>
                <div className="rounded-md border p-3 text-xs text-muted-foreground">View: {metric} · {product} · {period} · {status}</div>
              </div>
            ) : <p className="mt-3 text-sm text-muted-foreground">Select any county on the map to inspect it.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label:string; value:string; onChange:(v:string)=>void; options:string[] }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((o)=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>;
}
