import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPinned } from "lucide-react";
import { KenyaInsuranceMap } from "@/components/maps/kenya-insurance-map";
import { getGeographicAnalytics } from "@/lib/geographic/geographic-analytics.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/geographic-intelligence")({
  component: GeographicIntelligencePage,
});

const metrics = ["Policies", "Premium", "Claims", "Claim value", "Loss ratio", "Customers", "Renewals", "Expired"];
const metricKey: Record<string, any> = { Policies:"policies", Premium:"premium", Claims:"claims", "Claim value":"claim_value", "Loss ratio":"loss_ratio", Customers:"customers", Renewals:"renewals", Expired:"expired" };

function GeographicIntelligencePage() {
  const [metric, setMetric] = useState("Policies");
  const [product, setProduct] = useState("All products");
  const [period, setPeriod] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState("Active");
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const fetchAnalytics = useServerFn(getGeographicAnalytics);
  const analytics = useQuery({ queryKey:["geographic-analytics",metric,product,period,status], queryFn:()=>fetchAnalytics({data:{metric:metricKey[metric],product:product === "All products" ? "all" : product.toLowerCase(),year:Number(period),status:status === "All" ? "all" : status.toLowerCase()}}), staleTime:60_000 });
  const counties = analytics.data?.counties ?? [];
  const unmapped = analytics.data?.unmapped;
  const selected = counties.find((x:any)=>x.county.toLowerCase()===selectedCounty?.toLowerCase());
  const values = counties.map((x:any)=>({countyName:x.county,value:x.value}));

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

      {unmapped && (unmapped.customers > 0 || unmapped.policies > 0 || unmapped.claims > 0) && <Card><CardContent className="py-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">Unmapped historical records:</span> {unmapped.customers} customers · {unmapped.policies} policies · {unmapped.claims} claims · {unmapped.renewals} upcoming renewals. These remain outside county totals until their existing city/address can be resolved or a county is assigned.</CardContent></Card>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card><CardContent className="p-0"><KenyaInsuranceMap values={values} onCountyClick={setSelectedCounty} /></CardContent></Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-primary" /><h2 className="font-semibold">{selectedCounty ?? "County details"}</h2></div>
            {selectedCounty ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3"><Stat label="Policies" value={selected?.policies} /><Stat label="Customers" value={selected?.customers} /><Stat label="Premium" value={selected ? `KES ${Number(selected.premium).toLocaleString("en-KE")}` : "—"} /><Stat label="Claims" value={selected?.claims} /><Stat label="Claim value" value={selected ? `KES ${Number(selected.claimValue).toLocaleString("en-KE")}` : "—"} /><Stat label="Loss ratio" value={selected ? `${Number(selected.lossRatio).toFixed(1)}%` : "—"} /><Stat label="Renewals 30d" value={selected?.renewals} /><Stat label="Expired" value={selected?.expired} /></div>
                <div className="rounded-md border p-3 text-xs text-muted-foreground">View: {metric} · {product} · {period} · {status}</div>
              </div>
            ) : <p className="mt-3 text-sm text-muted-foreground">Select any county on the map to inspect it.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({label,value}:{label:string;value:any}) { return <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value ?? 0}</div></div>; }

function Filter({ label, value, onChange, options }: { label:string; value:string; onChange:(v:string)=>void; options:string[] }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((o)=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>;
}
