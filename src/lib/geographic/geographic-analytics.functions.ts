import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";
import { KENYA_COUNTIES } from "@/lib/geographic/kenya-counties";

const Input = z.object({
  metric: z.enum(["policies","premium","claims","claim_value","loss_ratio","customers","renewals","expired"]),
  product: z.string().default("all"),
  year: z.number().int().min(2000).max(2100),
  status: z.string().default("all"),
});

export type CountyAnalytics = {
  county: string; policies: number; premium: number; claims: number; claimValue: number;
  lossRatio: number; customers: number; renewals: number; expired: number; value: number;
};

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
      .select("id,status,premium_gross,start_date,end_date,product_class,client_id,clients(county)")
      .gte("start_date", from).lte("start_date", to);
    if (data.product !== "all") policiesQ = policiesQ.ilike("product_class", `%${data.product}%`);
    if (data.status !== "all") policiesQ = policiesQ.eq("status", data.status);

    let claimsQ: any = supabase.from("claims")
      .select("id,claim_amount,incident_date,client_id,clients(county)")
      .gte("incident_date", from).lte("incident_date", to);

    const [policiesRes, claimsRes, clientsRes, renewalsRes] = await Promise.all([
      policiesQ,
      claimsQ,
      supabase.from("clients").select("id,county"),
      supabase.from("policies").select("id,end_date,status,client_id,clients(county)")
        .in("status", ["active","pending"]).gte("end_date", today).lte("end_date", renewalTo),
    ]);
    for (const result of [policiesRes, claimsRes, clientsRes, renewalsRes]) if (result.error) throw new Error(result.error.message);

    const rows = new Map<string, CountyAnalytics>();
    for (const county of KENYA_COUNTIES) rows.set(county, { county, policies:0,premium:0,claims:0,claimValue:0,lossRatio:0,customers:0,renewals:0,expired:0,value:0 });
    const get = (name: unknown) => rows.get(String(name ?? "").trim());

    for (const c of clientsRes.data ?? []) { const r=get(c.county); if(r) r.customers++; }
    for (const p of policiesRes.data ?? []) {
      const r=get((p.clients as any)?.county); if(!r) continue;
      r.policies++; r.premium += Number(p.premium_gross ?? 0);
      if (p.status === "expired") r.expired++;
    }
    for (const c of claimsRes.data ?? []) {
      const r=get((c.clients as any)?.county); if(!r) continue;
      r.claims++; r.claimValue += Number(c.claim_amount ?? 0);
    }
    for (const p of renewalsRes.data ?? []) { const r=get((p.clients as any)?.county); if(r) r.renewals++; }

    for (const r of rows.values()) {
      r.lossRatio = r.premium > 0 ? (r.claimValue / r.premium) * 100 : 0;
      r.value = ({policies:r.policies,premium:r.premium,claims:r.claims,claim_value:r.claimValue,loss_ratio:r.lossRatio,customers:r.customers,renewals:r.renewals,expired:r.expired})[data.metric];
    }
    return [...rows.values()];
  });
