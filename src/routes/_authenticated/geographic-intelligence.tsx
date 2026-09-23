import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, MapPinned, Users, TrendingUp, RefreshCw, ShieldAlert } from "lucide-react";
import { KenyaInsuranceMap } from "@/components/maps/kenya-insurance-map";
import { getGeographicAnalytics } from "@/lib/geographic/geographic-analytics.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/geographic-intelligence")({
  component: GeographicIntelligencePage,
});

const metrics = ["Policies", "Premium", "Customers", "Agents", "Active agents", "Policies per agent", "Premium per agent", "Claims", "Claim value", "Loss ratio", "Renewals", "Expired", "Growth", "Opportunity"];
const metricKey: Record<string, any> = { Policies:"policies", Premium:"premium", Claims:"claims", "Claim value":"claim_value", "Loss ratio":"loss_ratio", Customers:"customers", Renewals:"renewals", Expired:"expired", Agents:"agents", "Active agents":"active_agents", "Policies per agent":"policies_per_agent", "Premium per agent":"premium_per_agent", Growth:"growth", Opportunity:"opportunity" };

function GeographicIntelligencePage() {
  const [metric, setMetric] = useState("Policies");
  const [product, setProduct] = useState("All products");
  const [period, setPeriod] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState("Active");
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const [selectedSubcounty, setSelectedSubcounty] = useState<string | null>(null);
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const level = selectedWard ? "ward" : selectedSubcounty ? "ward" : selectedCounty ? "subcounty" : "county";
  const fetchAnalytics = useServerFn(getGeographicAnalytics);
  const analytics = useQuery({ queryKey:["geographic-analytics",metric,product,period,status,level,selectedCounty,selectedSubcounty], queryFn:()=>fetchAnalytics({data:{metric:metricKey[metric],product:product === "All products" ? "all" : product.toLowerCase(),year:Number(period),status:status === "All" ? "all" : status.toLowerCase(),level,county:selectedCounty,subcounty:selectedSubcounty}}), staleTime:60_000 });
  const counties = analytics.data?.counties ?? [];
  const unmapped = analytics.data?.unmapped;
  const selectedName = selectedWard ?? selectedSubcounty ?? selectedCounty;
  const selected = counties.find((x:any)=>x.county.toLowerCase()===selectedName?.toLowerCase());
  const values = counties.map((x:any)=>({name:x.county,value:Number(x.value ?? 0)}));

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Geographic intelligence" subtitle="Explore portfolio distribution, claims risk, sales performance and renewal opportunity across Kenya." />

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <Filter label="Metric" value={metric} onChange={setMetric} options={metrics} />
          <Filter label="Product" value={product} onChange={setProduct} options={["All products","Motor","Medical","Property","Other"]} />
          <Filter label="Period" value={period} onChange={setPeriod} options={[String(new Date().getFullYear()),String(new Date().getFullYear()-1)]} />
          <Filter label="Status" value={status} onChange={setStatus} options={["Active","All","Expired"]} />
        </CardContent>
      </Card>

      {unmapped && (unmapped.customers > 0 || unmapped.policies > 0 || unmapped.claims > 0) && <Card><CardContent className="py-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">Unmapped historical records:</span> {unmapped.customers} customers · {unmapped.policies} policies · {unmapped.claims} claims · {unmapped.renewals} upcoming renewals. These remain outside county totals until their existing city/address can be resolved or a county is assigned.</CardContent></Card>}

      <div className="flex flex-wrap items-center gap-1 text-sm"><button className="font-medium hover:underline" onClick={()=>{setSelectedCounty(null);setSelectedSubcounty(null);setSelectedWard(null)}}>Kenya</button>{selectedCounty && <><ChevronRight className="h-4 w-4"/><button className="font-medium hover:underline" onClick={()=>{setSelectedSubcounty(null);setSelectedWard(null)}}>{selectedCounty}</button></>}{selectedSubcounty && <><ChevronRight className="h-4 w-4"/><button className="font-medium hover:underline" onClick={()=>setSelectedWard(null)}>{selectedSubcounty}</button></>}{selectedWard && <><ChevronRight className="h-4 w-4"/><span>{selectedWard}</span></>}</div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={<Users className="h-4 w-4"/>} label="Mapped customers" value={counties.reduce((s:any,r:any)=>s+Number(r.customers||0),0).toLocaleString("en-KE")} />
        <Summary icon={<Users className="h-4 w-4"/>} label="Active agents" value={counties.reduce((s:any,r:any)=>s+Number(r.activeAgents||0),0).toLocaleString("en-KE")} />
        <Summary icon={<RefreshCw className="h-4 w-4"/>} label="Renewals next 30d" value={counties.reduce((s:any,r:any)=>s+Number(r.renewals||0),0).toLocaleString("en-KE")} />
        <Summary icon={<TrendingUp className="h-4 w-4"/>} label="Selected metric total" value={metric.includes("Premium") ? `KES ${values.reduce((s,r)=>s+r.value,0).toLocaleString("en-KE")}` : values.reduce((s,r)=>s+r.value,0).toLocaleString("en-KE",{maximumFractionDigits:1})} />
      </div>

      {metric==="Opportunity" && <Card><CardContent className="flex gap-2 py-3 text-sm text-muted-foreground"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0"/><span><b className="text-foreground">Opportunity score</b> is an internal prioritisation signal using upcoming renewals, expired policies, customer concentration and active-agent coverage. It is not an estimate of total insurance penetration or market size.</span></CardContent></Card>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card><CardContent className="p-0"><KenyaInsuranceMap values={values} level={level} county={selectedCounty} subcounty={selectedSubcounty} onRegionClick={(name)=>{ if(level==="county"){setSelectedCounty(name);setSelectedSubcounty(null);setSelectedWard(null)} else if(level==="subcounty"){setSelectedSubcounty(name);setSelectedWard(null)} else setSelectedWard(name) }} /></CardContent></Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-primary" /><h2 className="font-semibold">{selectedName ?? "County details"}</h2></div>
            {selectedName ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3"><Stat label="Policies" value={selected?.policies} /><Stat label="Customers" value={selected?.customers} /><Stat label="Premium" value={selected ? `KES ${Number(selected.premium).toLocaleString("en-KE")}` : "—"} /><Stat label="Claims" value={selected?.claims} /><Stat label="Claim value" value={selected ? `KES ${Number(selected.claimValue).toLocaleString("en-KE")}` : "—"} /><Stat label="Loss ratio" value={selected ? `${Number(selected.lossRatio).toFixed(1)}%` : "—"} /><Stat label="Renewals 30d" value={selected?.renewals} /><Stat label="Expired" value={selected?.expired} /><Stat label="Agents" value={selected?.agents} /><Stat label="Active agents" value={selected?.activeAgents} /><Stat label="Policies / agent" value={selected ? Number(selected.policiesPerAgent ?? 0).toFixed(1) : "—"} /><Stat label="Premium / agent" value={selected ? `KES ${Number(selected.premiumPerAgent ?? 0).toLocaleString("en-KE")}` : "—"} /><Stat label="Growth YoY" value={selected ? `${Number(selected.growth ?? 0).toFixed(1)}%` : "—"} /><Stat label="Opportunity score" value={selected ? Number(selected.opportunity ?? 0).toFixed(1) : "—"} /></div>
                <div className="rounded-md border p-3 text-xs text-muted-foreground">View: {metric} · {product} · {period} · {status}</div>
              </div>
            ) : <p className="mt-3 text-sm text-muted-foreground">Select a county to zoom into its sub-counties, then select a sub-county to inspect its wards. Agent metrics represent staff who created policies in that geography; Opportunity is an internal planning indicator, not an external market-penetration estimate.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Summary({icon,label,value}:{icon:any;label:string;value:any}) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-md bg-muted p-2">{icon}</div><div><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div></CardContent></Card>; }

function Stat({label,value}:{label:string;value:any}) { return <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value ?? 0}</div></div>; }

function Filter({ label, value, onChange, options }: { label:string; value:string; onChange:(v:string)=>void; options:string[] }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((o)=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>;
}
