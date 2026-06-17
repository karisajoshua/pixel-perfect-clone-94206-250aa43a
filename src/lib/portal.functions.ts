import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getMyClient(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("*, branches(name)")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No client record linked to your account. Please contact your agent.");
  return data;
}

export const getPortalOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const client = await getMyClient(supabase, userId);
    const today = new Date().toISOString().slice(0, 10);
    const in60 = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);

    const [{ data: policies }, { data: invoices }, { data: claims }] = await Promise.all([
      supabase.from("policies").select("id,policy_no,status,end_date,premium_gross,insurers(name)").eq("client_id", client.id).order("end_date", { ascending: true }),
      supabase.from("invoices").select("id,invoice_no,total,amount_paid,status,due_date").eq("client_id", client.id),
      supabase.from("claims").select("id,claim_no,status,incident_date,created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(5),
    ]);

    const active = (policies ?? []).filter((p: any) => p.status === "active");
    const nextRenewal = active.find((p: any) => p.end_date >= today && p.end_date <= in60) ?? active[0] ?? null;
    const outstanding = (invoices ?? []).reduce((s: number, i: any) => s + (Number(i.total) - Number(i.amount_paid || 0)), 0);
    const openClaims = (claims ?? []).filter((c: any) => c.status !== "settled" && c.status !== "closed").length;

    return {
      client,
      kpis: {
        activePolicies: active.length,
        nextRenewal,
        outstanding,
        openClaims,
      },
      recentClaims: claims ?? [],
    };
  });

export const listMyPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("policies")
      .select("*, insurers(name,short_code), vehicles(registration_no,make,model)")
      .eq("client_id", client.id)
      .order("end_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getMyPolicy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data: policy, error } = await context.supabase
      .from("policies")
      .select("*, insurers(name,short_code), vehicles(*)")
      .eq("id", data.id)
      .eq("client_id", client.id)
      .maybeSingle();
    if (error) throw error;
    if (!policy) throw new Error("Policy not found");
    const { data: invoices } = await context.supabase
      .from("invoices")
      .select("id,invoice_no,issue_date,due_date,total,amount_paid,status")
      .eq("policy_id", policy.id)
      .order("issue_date", { ascending: false });
    return { policy, invoices: invoices ?? [] };
  });

export const listMyVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("vehicles")
      .select("*, policies(id,policy_no,status,end_date)")
      .eq("client_id", client.id)
      .order("registration_no");
    if (error) throw error;
    return data ?? [];
  });

export const listMyInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("invoices")
      .select("*, policies(policy_no)")
      .eq("client_id", client.id)
      .order("issue_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getMyInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data: invoice, error } = await context.supabase
      .from("invoices")
      .select("*, policies(policy_no), invoice_items(*), payments(*), branches(name, address, phone, email), clients(full_name, company_name, client_type, email, phone)")
      .eq("id", data.id)
      .eq("client_id", client.id)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) throw new Error("Invoice not found");
    return invoice;
  });

export const listMyClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("claims")
      .select("*, policies(policy_no), vehicles(registration_no)")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const reportClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      policy_id: z.string().uuid().optional().nullable(),
      vehicle_id: z.string().uuid().optional().nullable(),
      incident_date: z.string().min(1),
      incident_location: z.string().optional().nullable(),
      description: z.string().min(5),
      claim_amount: z.number().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const claimNo = `CLM-${Date.now().toString().slice(-8)}`;
    const { data: row, error } = await context.supabase
      .from("claims")
      .insert({
        claim_no: claimNo,
        client_id: client.id,
        policy_id: data.policy_id || null,
        vehicle_id: data.vehicle_id || null,
        branch_id: client.branch_id,
        incident_date: data.incident_date,
        incident_location: data.incident_location || null,
        description: data.description,
        claim_amount: data.claim_amount ?? null,
        status: "reported",
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const listMyDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data, error } = await context.supabase.storage
      .from("client-documents")
      .list(client.id, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    const files = (data ?? []).filter((f: any) => f.name && f.id);
    const signed = await Promise.all(
      files.map(async (f: any) => {
        const { data: s } = await context.supabase.storage
          .from("client-documents")
          .createSignedUrl(`${client.id}/${f.name}`, 60 * 30);
        return { name: f.name, size: f.metadata?.size, created_at: f.created_at, url: s?.signedUrl ?? null };
      }),
    );
    return signed;
  });