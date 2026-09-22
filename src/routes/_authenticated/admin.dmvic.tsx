import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldCheck, Server, Settings2, PackageSearch, BadgeCheck } from "lucide-react";
import { requireRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dmvicConnectionStatus } from "@/lib/dmvic/dmvic.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/dmvic")({
  beforeLoad: requireRole(["admin"]),
  head: () => ({ meta: [{ title: "DMVIC Configuration" }] }),
  component: DmvicPage,
});

const money=(n:any)=>`KES ${Number(n||0).toLocaleString()}`;

function DmvicPage() {
  const qc=useQueryClient();
  const statusFn=useServerFn(dmvicConnectionStatus);
  const [price,setPrice]=useState<any>({certificate_type:"A",classification:"",selling_price:"",dmvic_cost:""});
  const [rate,setRate]=useState<any>({insurer_id:"",cover_type:"comprehensive",vehicle_category:"private",rate_percent:"",flat_premium:"",minimum_premium:""});
  const {data:status,isLoading}=useQuery({queryKey:["dmvic-status"],queryFn:()=>statusFn(),retry:false});
  const {data:orders=[]}=useQuery({queryKey:["dmvic-admin-orders"],queryFn:async()=>{const {data,error}=await (supabase as any).from("dmvic_certificate_orders").select("*, insurers(name), tenants(name)").order("created_at",{ascending:false}).limit(100);if(error)throw error;return data??[];}});
  const {data:prices=[]}=useQuery({queryKey:["dmvic-prices"],queryFn:async()=>{const {data,error}=await (supabase as any).from("dmvic_certificate_prices").select("*").order("certificate_type");if(error)throw error;return data??[];}});
  const {data:insurers=[]}=useQuery({queryKey:["dmvic-insurers"],queryFn:async()=>{const {data,error}=await (supabase as any).from("insurers").select("id,name,active,dmvic_member_company_id").order("name");if(error)throw error;return data??[];}});
  const {data:rates=[]}=useQuery({queryKey:["motor-rates-admin"],queryFn:async()=>{const {data,error}=await (supabase as any).from("motor_insurer_rates").select("*, insurers(name)").order("created_at",{ascending:false}).limit(100);if(error)throw error;return data??[];}});
  const {data:tenants=[]}=useQuery({queryKey:["dmvic-tenants"],queryFn:async()=>{const {data,error}=await (supabase as any).from("tenants").select("id,name,ira_number,ira_verification_status,ira_verified_at").order("name");if(error)throw error;return data??[];}});
  const {data:settlements=[]}=useQuery({queryKey:["dmvic-settlements"],queryFn:async()=>{const {data,error}=await (supabase as any).from("dmvic_settlements").select("*").order("created_at",{ascending:false}).limit(100);if(error)throw error;return data??[];}});

  const saveMember=async(id:string,value:string)=>{const n=value.trim()?Number(value):null;if(value.trim()&&(!Number.isInteger(n)||Number(n)<=0))return toast.error("MemberCompanyID must be a positive number");const {error}=await (supabase as any).from("insurers").update({dmvic_member_company_id:n}).eq("id",id);if(error)return toast.error(error.message);toast.success("DMVIC insurer mapping saved");qc.invalidateQueries({queryKey:["dmvic-insurers"]});};
  const savePrice=async()=>{if(!price.selling_price)return toast.error("Selling price is required");const {error}=await (supabase as any).from("dmvic_certificate_prices").insert({certificate_type:price.certificate_type,classification:price.classification?Number(price.classification):null,selling_price:Number(price.selling_price),dmvic_cost:price.dmvic_cost===""?null:Number(price.dmvic_cost)});if(error)return toast.error(error.message);setPrice({...price,classification:"",selling_price:"",dmvic_cost:""});toast.success("Certificate price saved");qc.invalidateQueries({queryKey:["dmvic-prices"]});};
  const saveRate=async()=>{if(!rate.insurer_id)return toast.error("Select an insurer");const {error}=await (supabase as any).from("motor_insurer_rates").insert({insurer_id:rate.insurer_id,cover_type:rate.cover_type,vehicle_category:rate.vehicle_category,rate_percent:rate.rate_percent===""?null:Number(rate.rate_percent),flat_premium:rate.flat_premium===""?null:Number(rate.flat_premium),minimum_premium:rate.minimum_premium===""?null:Number(rate.minimum_premium),active:true});if(error)return toast.error(error.message);toast.success("Motor insurer rate saved");qc.invalidateQueries({queryKey:["motor-rates-admin"]});};
  const verifyIra=async(id:string,s:string)=>{const {error}=await (supabase as any).from("tenants").update({ira_verification_status:s,ira_verified_at:s==="verified"?new Date().toISOString():null}).eq("id",id);if(error)return toast.error(error.message);toast.success("IRA status updated");qc.invalidateQueries({queryKey:["dmvic-tenants"]});};

  const issued=orders.filter((o:any)=>o.status==="issued"), collected=issued.reduce((s:number,o:any)=>s+Number(o.selling_price||0),0), liability=issued.reduce((s:number,o:any)=>s+Number(o.dmvic_cost||0),0), settled=settlements.filter((x:any)=>x.status==="settled").reduce((s:number,x:any)=>s+Number(x.amount||0),0);

  return <div className="space-y-6 p-4 md:p-8">
    <PageHeader title="DMVIC Configuration" subtitle="Super Admin control centre for DMVIC mappings, pricing, agency verification, orders and reconciliation."/>
    <Card><CardHeader><CardTitle className="flex gap-2 items-center"><Server className="h-5 w-5"/>DMVIC UAT connection</CardTitle></CardHeader><CardContent>{isLoading?<Badge variant="outline">Checking…</Badge>:status?.configured?<Badge variant="secondary"><ShieldCheck className="h-3 w-3 mr-1"/>Configured · UAT</Badge>:<Badge variant="destructive">Not configured</Badge>}</CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-5">{[["Orders",orders.length],["Issued",issued.length],["Collections",money(collected)],["DMVIC liability",money(liability)],["Outstanding",money(Math.max(0,liability-settled))]].map(([k,v])=><Card key={String(k)}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-lg font-semibold">{v}</div></CardContent></Card>)}</div>

    <Card><CardHeader><CardTitle className="flex gap-2 items-center"><Settings2 className="h-5 w-5"/>Insurer → DMVIC MemberCompanyID</CardTitle><CardDescription>Enter only IDs supplied by DMVIC. Unmapped insurers must not issue certificates.</CardDescription></CardHeader><CardContent className="space-y-2">{insurers.map((i:any)=><div key={i.id} className="grid grid-cols-[1fr_160px] gap-3 items-center border-b py-2"><div>{i.name}</div><Input key={String(i.dmvic_member_company_id??"")} defaultValue={i.dmvic_member_company_id??""} placeholder="Not mapped" onBlur={e=>saveMember(i.id,e.target.value)}/></div>)}</CardContent></Card>

    <Card><CardHeader><CardTitle>Certificate prices & DMVIC cost</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid md:grid-cols-5 gap-2"><Select value={price.certificate_type} onValueChange={v=>setPrice({...price,certificate_type:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["A","B","C","D"].map(x=><SelectItem key={x} value={x}>Type {x}</SelectItem>)}</SelectContent></Select><Input placeholder="Classification" value={price.classification} onChange={e=>setPrice({...price,classification:e.target.value})}/><Input type="number" placeholder="Selling price" value={price.selling_price} onChange={e=>setPrice({...price,selling_price:e.target.value})}/><Input type="number" placeholder="DMVIC cost" value={price.dmvic_cost} onChange={e=>setPrice({...price,dmvic_cost:e.target.value})}/><Button onClick={savePrice}>Add price</Button></div><div className="text-sm space-y-1">{prices.map((p:any)=><div key={p.id} className="grid grid-cols-4 border-b py-2"><span>Type {p.certificate_type}{p.classification?` · ${p.classification}`:""}</span><span>{money(p.selling_price)}</span><span>Cost {p.dmvic_cost==null?"—":money(p.dmvic_cost)}</span><Badge variant={p.active?"secondary":"outline"}>{p.active?"Active":"Inactive"}</Badge></div>)}</div></CardContent></Card>

    <Card><CardHeader><CardTitle>Motor insurer rates</CardTitle><CardDescription>Rates used for insurer comparison and the immutable company/base price before agent markup.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid md:grid-cols-6 gap-2"><Select value={rate.insurer_id} onValueChange={v=>setRate({...rate,insurer_id:v})}><SelectTrigger><SelectValue placeholder="Insurer"/></SelectTrigger><SelectContent>{insurers.filter((x:any)=>x.active).map((x:any)=><SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select><Input placeholder="Cover type" value={rate.cover_type} onChange={e=>setRate({...rate,cover_type:e.target.value})}/><Input placeholder="Vehicle category" value={rate.vehicle_category} onChange={e=>setRate({...rate,vehicle_category:e.target.value})}/><Input type="number" placeholder="Rate %" value={rate.rate_percent} onChange={e=>setRate({...rate,rate_percent:e.target.value})}/><Input type="number" placeholder="Flat/min premium" value={rate.flat_premium} onChange={e=>setRate({...rate,flat_premium:e.target.value})}/><Button onClick={saveRate}>Add rate</Button></div><div className="text-sm space-y-1">{rates.map((r:any)=><div key={r.id} className="grid md:grid-cols-5 border-b py-2"><span>{r.insurers?.name}</span><span>{r.cover_type}</span><span>{r.vehicle_category}</span><span>{r.rate_percent!=null?`${r.rate_percent}%`:money(r.flat_premium)}</span><Badge variant={r.active?"secondary":"outline"}>{r.active?"Active":"Inactive"}</Badge></div>)}</div></CardContent></Card>

    <Card><CardHeader><CardTitle className="flex gap-2 items-center"><BadgeCheck className="h-5 w-5"/>Agency IRA verification</CardTitle><CardDescription>Manual administrative verification until an authoritative automated verification source is connected.</CardDescription></CardHeader><CardContent className="space-y-2">{tenants.map((t:any)=><div key={t.id} className="grid md:grid-cols-[1fr_180px_180px] gap-2 items-center border-b py-2"><div><div className="font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.ira_number||"No IRA number"}</div></div><Badge variant={t.ira_verification_status==="verified"?"secondary":"outline"}>{t.ira_verification_status}</Badge><Select value={t.ira_verification_status} onValueChange={v=>verifyIra(t.id,v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div>)}</CardContent></Card>

    <Card><CardHeader><CardTitle className="flex gap-2 items-center"><PackageSearch className="h-5 w-5"/>Recent certificate orders</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Created</th><th>Agency</th><th>Insurer</th><th>Status</th><th>Payment</th><th>Certificate</th><th>Price</th></tr></thead><tbody>{orders.map((o:any)=><tr key={o.id} className="border-b"><td className="py-2">{new Date(o.created_at).toLocaleDateString()}</td><td>{o.tenants?.name||"—"}</td><td>{o.insurers?.name||"—"}</td><td><Badge variant="outline">{o.status}</Badge></td><td>{o.payment_status}</td><td className="font-mono">{o.dmvic_certificate_number||"—"}</td><td>{money(o.selling_price)}</td></tr>)}</tbody></table></CardContent></Card>

    <Card><CardHeader><CardTitle>Settlement & reconciliation</CardTitle><CardDescription>Customer collections and DMVIC settlement remain separate ledgers.</CardDescription></CardHeader><CardContent className="text-sm">Issued liability: <b>{money(liability)}</b> · Settled: <b>{money(settled)}</b> · Outstanding: <b>{money(Math.max(0,liability-settled))}</b></CardContent></Card>
  </div>;
}
