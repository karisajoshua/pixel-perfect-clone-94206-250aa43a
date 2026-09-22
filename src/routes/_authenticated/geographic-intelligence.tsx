import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPinned } from "lucide-react";
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

      <Card>
        <CardContent className="p-0">
          <div className="grid min-h-[520px] place-items-center p-8 text-center">
            <div className="max-w-lg space-y-3">
              <MapPinned className="mx-auto h-12 w-12 text-primary" />
              <h2 className="text-xl font-semibold">Kenya insurance map is being connected</h2>
              <p className="text-sm text-muted-foreground">
                MapLibre is installed and the geographic intelligence workspace is ready. The next data step connects authoritative Kenya county boundaries and tenant-scoped insurance aggregates before the live choropleth is rendered.
              </p>
              <p className="text-xs text-muted-foreground">Current view: {metric} · {product} · {period} · {status}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label:string; value:string; onChange:(v:string)=>void; options:string[] }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((o)=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>;
}
