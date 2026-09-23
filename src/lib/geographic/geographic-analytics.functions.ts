import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";
import { KENYA_COUNTIES, resolveKenyaCounty } from "@/lib/geographic/kenya-counties";

const Input = z.object({
  metric: z.enum(["policies","premium","claims","claim_value","loss_ratio","customers","renewals","expired"]),
  product: z.string().default("all"),
  year: z.number().int().min(2000).max(2100),
  status: z.string().default("all"),
  level: z.enum(["county","subcounty","ward"]).default("county"),
  county: z.string().nullable().optional(),
  subcounty: z.string().nullable().optional(),
});

export type CountyAnalytics = {
  county: string; policies: number; premium: number; claims: number; claimValue: number;
  lossRatio: number; customers: number; renewals: number; expired: number; value: number;
};

export type GeographicAnalyticsResult = { counties: CountyAnalytics[]; unmapped: { customers:number; policies:number; claims:number; renewals:number } };

export const getGeographicAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = `${data.year}-01-01`;
    const to = `${data.year}-12-31`;
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const renewalTo = in30.toISOString().slice(0, 10);

    let policiesQ: any = supabase.from("policies")
      .select("id,status,premium_gross,start_date,end_date,product_class,client_id,clients(county,subcounty,ward,city,address)")
      .gte("start_date", from).lte("start_date", to);
    if (data.product !== "all") policiesQ = policiesQ.ilike("product_class", `%${data.product}%`);
    if (data.status !== "all") policiesQ = policiesQ.eq("status", data.status);

    let claimsQ: any = supabase.from("claims")
      .select("id,claim_amount,incident_date,client_id,clients(county,subcounty,ward,city,address)")
      .gte("incident_date", from).lte("incident_date", to);

    const [policiesRes, claimsRes, clientsRes, renewalsRes] = await Promise.all([
      policiesQ,
      claimsQ,
      supabase.from("clients").select("id,county,subcounty,ward,city,address"),
      supabase.from("policies").select("id,end_date,status,client_id,clients(county,subcounty,ward,city,address)")
        .in("status", ["active","pending"]).gte("end_date", today).lte("end_date", renewalTo),
    ]);
    for (const result of [policiesRes, claimsRes, clientsRes, renewalsRes]) if (result.error) throw new Error(result.error.message);

    const rows = new Map<string, CountyAnalytics>();
    for (const county of KENYA_COUNTIES) rows.set(county, { county, policies:0,premium:0,claims:0,claimValue:0,lossRatio:0,customers:0,renewals:0,expired:0,value:0 });
    const unmapped = { customers:0, policies:0, claims:0, renewals:0 };
    const countyFor = (client: any) => resolveKenyaCounty(client?.county, client?.city, client?.address);
    const get = (client: any) => { const county=countyFor(client); return county ? rows.get(county) : undefined; };

    for (const c of clientsRes.data ?? []) { const r=get(c); if(r) r.customers++; else unmapped.customers++; }
    for (const p of policiesRes.data ?? []) {
      const r=get(p.clients as any); if(!r) { unmapped.policies++; continue; }
      r.policies++; r.premium += Number(p.premium_gross ?? 0);
      if (p.status === "expired") r.expired++;
    }
    for (const c of claimsRes.data ?? []) {
      const r=get(c.clients as any); if(!r) { unmapped.claims++; continue; }
      r.claims++; r.claimValue += Number(c.claim_amount ?? 0);
    }
    for (const p of renewalsRes.data ?? []) { const r=get(p.clients as any); if(r) r.renewals++; else unmapped.renewals++; }

    for (const r of rows.values()) {
      r.lossRatio = r.premium > 0 ? (r.claimValue / r.premium) * 100 : 0;
      r.value = ({policies:r.policies,premium:r.premium,claims:r.claims,claim_value:r.claimValue,loss_ratio:r.lossRatio,customers:r.customers,renewals:r.renewals,expired:r.expired})[data.metric];
    }
    if (data.level === "county") return { counties:[...rows.values()], unmapped };

    const scoped = new Map<string, CountyAnalytics>();
    const keyFor = (client:any) => {
      const resolvedCounty = countyFor(client);
      if (!resolvedCounty || (data.county && resolvedCounty.toLowerCase() !== data.county.toLowerCase())) return null;
      const key = data.level === "subcounty" ? client?.subcounty : client?.ward;
      if (data.level === "ward" && data.subcounty && String(client?.subcounty ?? "").toLowerCase() !== data.subcounty.toLowerCase()) return null;
      return String(key ?? "").trim() || null;
    };
    const rowFor = (name:string) => {
      if (!scoped.has(name)) scoped.set(name,{county:name,policies:0,premium:0,claims:0,claimValue:0,lossRatio:0,customers:0,renewals:0,expired:0,value:0});
      return scoped.get(name)!;
    };
    const scopedUnmapped={customers:0,policies:0,claims:0,renewals:0};
    for(const client of clientsRes.data ?? []) { const k=keyFor(client); if(k) rowFor(k).customers++; else if(countyFor(client)===data.county) scopedUnmapped.customers++; }
    for(const p of policiesRes.data ?? []) { const k=keyFor(p.clients); if(!k){ if(countyFor(p.clients)===data.county) scopedUnmapped.policies++; continue; } const r=rowFor(k); r.policies++; r.premium+=Number(p.premium_gross??0); if(p.status==="expired") r.expired++; }
    for(const claim of claimsRes.data ?? []) { const k=keyFor(claim.clients); if(!k){ if(countyFor(claim.clients)===data.county) scopedUnmapped.claims++; continue; } const r=rowFor(k); r.claims++; r.claimValue+=Number(claim.claim_amount??0); }
    for(const p of renewalsRes.data ?? []) { const k=keyFor(p.clients); if(k) rowFor(k).renewals++; else if(countyFor(p.clients)===data.county) scopedUnmapped.renewals++; }
    for(const r of scoped.values()){ r.lossRatio=r.premium>0?(r.claimValue/r.premium)*100:0; r.value=({policies:r.policies,premium:r.premium,claims:r.claims,claim_value:r.claimValue,loss_ratio:r.lossRatio,customers:r.customers,renewals:r.renewals,expired:r.expired})[data.metric]; }
    return { counties:[...scoped.values()], unmapped:scopedUnmapped };
  });
