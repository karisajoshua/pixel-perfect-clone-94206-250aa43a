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

    const missingFields: string[] = [];
    if (!client.id_number) missingFields.push("ID number");
    if (!client.kra_pin) missingFields.push("KRA PIN");
    if (!client.phone) missingFields.push("Phone");
    if (!client.address) missingFields.push("Postal address");
    if (!client.date_of_birth && client.client_type === "individual") missingFields.push("Date of birth");

    const { count: kycCount } = await supabase
      .from("client_required_documents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id);
    const hasUploadedDocs = (kycCount ?? 0) > 0;

    return {
      client,
      kpis: {
        activePolicies: active.length,
        nextRenewal,
        outstanding,
        openClaims,
      },
      recentClaims: claims ?? [],
      kyc: {
        status: client.kyc_status as string,
        missingFields,
        hasUploadedDocs,
        complete: client.kyc_status === "verified",
      },
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
    const [rootRes, kycRes, uploadsRes] = await Promise.all([
      context.supabase.storage.from("client-documents").list(client.id, { limit: 200, sortBy: { column: "created_at", order: "desc" } }),
      context.supabase.storage.from("client-documents").list(`${client.id}/kyc`, { limit: 200, sortBy: { column: "created_at", order: "desc" } }),
      context.supabase.storage.from("client-documents").list(`${client.id}/uploads`, { limit: 200, sortBy: { column: "created_at", order: "desc" } }),
    ]);
    if (rootRes.error) throw rootRes.error;
    const entries: { folder: "shared" | "kyc" | "uploads"; name: string; meta: any }[] = [];
    for (const f of rootRes.data ?? []) {
      if (f.name && f.id && f.name !== "kyc" && f.name !== "uploads") entries.push({ folder: "shared", name: f.name, meta: f });
    }
    for (const f of kycRes.data ?? []) {
      if (f.name && f.id) entries.push({ folder: "kyc", name: f.name, meta: f });
    }
    for (const f of uploadsRes.data ?? []) {
      if (f.name && f.id) entries.push({ folder: "uploads", name: f.name, meta: f });
    }
    const signed = await Promise.all(
      entries.map(async (e) => {
        const path =
          e.folder === "kyc"
            ? `${client.id}/kyc/${e.name}`
            : e.folder === "uploads"
              ? `${client.id}/uploads/${e.name}`
              : `${client.id}/${e.name}`;
        const { data: s } = await context.supabase.storage.from("client-documents").createSignedUrl(path, 60 * 30);
        return {
          name: e.name,
          folder: e.folder,
          path,
          size: e.meta.metadata?.size,
          created_at: e.meta.created_at,
          url: s?.signedUrl ?? null,
          canDelete: e.folder === "kyc" || e.folder === "uploads",
        };
      }),
    );
    return signed;
  });

export const createMyUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_name: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const safeName = data.file_name.replace(/[^\w.\-]+/g, "_");
    const path = `${client.id}/uploads/${Date.now()}-${safeName}`;
    const { data: signed, error } = await context.supabase.storage
      .from("client-documents")
      .createSignedUploadUrl(path);
    if (error || !signed) throw error ?? new Error("Could not create upload URL");
    return { path: signed.path, token: signed.token };
  });

export const deleteMyUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    if (!data.path.startsWith(`${client.id}/uploads/`)) throw new Error("Invalid path");
    const { error } = await context.supabase.storage.from("client-documents").remove([data.path]);
    if (error) throw error;
    return { ok: true };
  });

const updateProfileSchema = z.object({
  phone: z.string().trim().max(40).optional().nullable(),
  alt_phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  date_of_birth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .nullable()
    .or(z.literal("")),
  id_number: z.string().trim().max(40).optional().nullable(),
  kra_pin: z.string().trim().max(40).optional().nullable(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const norm = (v: string | null | undefined) => {
      if (v === undefined) return undefined;
      const t = (v ?? "").trim();
      return t === "" ? null : t;
    };
    const payload: Record<string, any> = {
      phone: norm(data.phone),
      alt_phone: norm(data.alt_phone),
      address: norm(data.address),
      city: norm(data.city),
      date_of_birth: norm(data.date_of_birth),
    };
    if (client.kyc_status !== "verified") {
      payload.id_number = norm(data.id_number);
      payload.kra_pin = norm(data.kra_pin);
    }
    const { data: updated, error } = await context.supabase
      .from("clients")
      .update(payload as any)
      .eq("id", client.id)
      .select("*, branches(name)")
      .single();
    if (error) throw error;
    return updated;
  });

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: rolesData }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, phone, branch_id, avatar_url").eq("id", userId).maybeSingle(),
    ]);
    const roles = (rolesData ?? []).map((r: any) => r.role as string);
    const isAdmin = roles.includes("admin");
    const isStaff = isAdmin || roles.includes("manager") || roles.includes("agent");

    const items: { id: string; label: string; done: boolean; href: string; required: boolean }[] = [];

    if (isStaff) {
      items.push({
        id: "profile-phone",
        label: "Add your phone number to your profile",
        done: !!profile?.phone,
        href: "/admin/users",
        required: false,
      });
      items.push({
        id: "profile-branch",
        label: "Get assigned to a branch",
        done: !!profile?.branch_id,
        href: "/admin/branches",
        required: true,
      });
    }

    if (isAdmin) {
      const [{ count: branches }, { count: insurers }, { count: staff }, { count: clients }] = await Promise.all([
        supabase.from("branches").select("id", { count: "exact", head: true }),
        supabase.from("insurers").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).neq("role", "client"),
        supabase.from("clients").select("id", { count: "exact", head: true }),
      ]);
      items.push({ id: "branches", label: "Create your first branch", done: (branches ?? 0) > 0, href: "/admin/branches", required: true });
      items.push({ id: "insurers", label: "Add at least one insurer", done: (insurers ?? 0) > 0, href: "/admin/insurers", required: true });
      items.push({ id: "staff", label: "Invite another staff member", done: (staff ?? 0) > 1, href: "/admin/users", required: false });
      items.push({ id: "clients", label: "Onboard your first client", done: (clients ?? 0) > 0, href: "/clients", required: false });
    } else if (isStaff) {
      const { count: clients } = await supabase.from("clients").select("id", { count: "exact", head: true });
      items.push({ id: "clients", label: "Add your first client", done: (clients ?? 0) > 0, href: "/clients", required: false });
    }

    const totalRequired = items.filter((i) => i.required).length;
    const doneRequired = items.filter((i) => i.required && i.done).length;
    return {
      roles,
      items,
      complete: items.every((i) => i.done),
      requiredComplete: totalRequired > 0 ? doneRequired === totalRequired : true,
    };
  });