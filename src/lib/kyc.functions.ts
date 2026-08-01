import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KycDocType =
  | "id_front"
  | "id_back"
  | "kra_pin"
  | "proof_of_address"
  | "passport_photo"
  | "cert_incorporation"
  | "cr12"
  | "director_id";
  // Vehicle documents (any one or more)
export type KycDocTypeAll = KycDocType | "log_book" | "importation_doc" | "search_doc";

export type KycSlot = {
  doc_type: KycDocType;
  label: string;
  description: string;
  required: boolean;
};

export const INDIVIDUAL_SLOTS: KycSlot[] = [
  { doc_type: "id_front", label: "National ID — front", description: "Clear photo of the front of your National ID or Passport bio page.", required: true },
  { doc_type: "id_back", label: "National ID — back", description: "Back of your National ID (optional; skip if using a passport).", required: false },
  { doc_type: "kra_pin", label: "KRA PIN certificate", description: "Your personal KRA PIN certificate (PDF preferred).", required: true },
  { doc_type: "proof_of_address", label: "Proof of address", description: "Utility bill or bank statement issued in the last 3 months (optional).", required: false },
  { doc_type: "passport_photo", label: "Passport photo", description: "Recent passport-size photo on a plain background.", required: false },
];

export const CORPORATE_SLOTS: KycSlot[] = [
  { doc_type: "cert_incorporation", label: "Certificate of incorporation", description: "Company registration certificate.", required: true },
  { doc_type: "cr12", label: "CR12 / company registry extract", description: "Issued by the Business Registration Service.", required: true },
  { doc_type: "kra_pin", label: "Company KRA PIN certificate", description: "Company KRA PIN.", required: true },
  { doc_type: "director_id", label: "Director's ID", description: "ID copy of the principal director or authorized signatory.", required: true },
  { doc_type: "proof_of_address", label: "Proof of address", description: "Recent utility bill or bank statement for the business address (optional).", required: false },
];

export const VEHICLE_SLOTS: KycSlot[] = [
  { doc_type: "log_book" as KycDocType, label: "Log book", description: "Vehicle log book (any of log book, importation document, or search document is acceptable).", required: false },
  { doc_type: "importation_doc" as KycDocType, label: "Importation document", description: "Vehicle importation document (IDF / bill of entry).", required: false },
  { doc_type: "search_doc" as KycDocType, label: "Search document", description: "NTSA search / records confirmation document.", required: false },
];

const DOC_TYPE_ENUM = [
  "id_front","id_back","kra_pin","proof_of_address","passport_photo",
  "cert_incorporation","cr12","director_id",
  "log_book","importation_doc","search_doc",
] as const;

const VEHICLE_DOC_TYPES = ["log_book", "importation_doc", "search_doc"] as const;

function vehicleFilter(q: any, vehicleId?: string | null) {
  return vehicleId ? q.eq("vehicle_id", vehicleId) : q.is("vehicle_id", null);
}

/** Upsert a document row honouring the partial unique indexes (client-level vs per-vehicle). */
async function saveDocRow(
  admin: any,
  args: {
    client_id: string;
    tenant_id?: string | null;
    vehicle_id?: string | null;
    doc_type: string;
    storage_path: string;
    file_name: string;
    status: "pending" | "verified";
    verified_by?: string | null;
  },
) {
  const { data: existing } = await vehicleFilter(
    admin
      .from("client_required_documents")
      .select("id, storage_path, tenant_id")
      .eq("client_id", args.client_id)
      .eq("doc_type", args.doc_type),
    args.vehicle_id ?? null,
  ).maybeSingle();

  if (existing?.storage_path && existing.storage_path !== args.storage_path) {
    await admin.storage.from("client-documents").remove([existing.storage_path]);
  }

  let tenantId = (args.tenant_id ?? existing?.tenant_id) as string | undefined | null;
  if (!tenantId) {
    const { data: c } = await admin.from("clients").select("tenant_id").eq("id", args.client_id).maybeSingle();
    tenantId = (c as any)?.tenant_id;
  }

  const payload: any = {
    client_id: args.client_id,
    tenant_id: tenantId,
    vehicle_id: args.vehicle_id ?? null,
    doc_type: args.doc_type,
    storage_path: args.storage_path,
    file_name: args.file_name,
    status: args.status,
    rejection_reason: null,
    verified_at: args.status === "verified" ? new Date().toISOString() : null,
    verified_by: args.status === "verified" ? args.verified_by ?? null : null,
  };

  if (existing?.id) {
    const { data, error } = await admin
      .from("client_required_documents")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await admin
    .from("client_required_documents")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function maybeAutoVerifyClientKyc(clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, client_type, kyc_status")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || client.kyc_status === "verified") return;
  const required = (client.client_type === "corporate" ? CORPORATE_SLOTS : INDIVIDUAL_SLOTS)
    .filter((s) => s.required)
    .map((s) => s.doc_type);
  if (required.length === 0) return;
  const { data: rows } = await supabaseAdmin
    .from("client_required_documents")
    .select("doc_type")
    .eq("client_id", clientId)
    .in("doc_type", required as any);
  const have = new Set((rows ?? []).map((r: any) => r.doc_type));
  if (required.every((t) => have.has(t))) {
    await (supabaseAdmin.from("clients") as any)
      .update({ kyc_status: "verified" })
      .eq("id", clientId);
  }
}

async function getMyClient(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, client_type, kyc_status, assigned_agent, full_name, email, branch_id, auth_user_id, tenant_id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Your account isn't linked to a client record yet. Please contact your agent so they can link it.");
  return data;
}

export const getMyRequiredDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const baseSlots = client.client_type === "corporate" ? CORPORATE_SLOTS : INDIVIDUAL_SLOTS;
    const slots = baseSlots;
    const { data: rows, error } = await context.supabase
      .from("client_required_documents")
      .select("id, doc_type, vehicle_id, storage_path, file_name, status, rejection_reason, verified_at, created_at, expires_at")
      .eq("client_id", client.id)
      .is("vehicle_id", null);
    if (error) throw error;

    const byType = new Map<string, any>();
    for (const r of rows ?? []) byType.set(r.doc_type, r);

    const items = await Promise.all(
      slots.map(async (slot) => {
        const row = byType.get(slot.doc_type);
        let url: string | null = null;
        if (row?.storage_path) {
          const { data: signed } = await context.supabase.storage
            .from("client-documents")
            .createSignedUrl(row.storage_path, 60 * 30);
          url = signed?.signedUrl ?? null;
        }
        return { ...slot, row: row ?? null, url };
      }),
    );

    const requiredDone = items.filter((i) => i.required && i.row).length;
    const requiredTotal = items.filter((i) => i.required).length;
    const canSubmit = requiredDone === requiredTotal && client.kyc_status !== "in_review" && client.kyc_status !== "verified";

    // Per-vehicle documents
    const { data: vehicles } = await context.supabase
      .from("vehicles")
      .select("id, registration_no, make, model")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    const vehicleIds = (vehicles ?? []).map((v: any) => v.id);
    let vRows: any[] = [];
    if (vehicleIds.length) {
      const { data } = await context.supabase
        .from("client_required_documents")
        .select("id, doc_type, vehicle_id, storage_path, file_name, status, rejection_reason, verified_at")
        .in("vehicle_id", vehicleIds);
      vRows = data ?? [];
    }
    const vehicleGroups = await Promise.all(
      (vehicles ?? []).map(async (v: any) => ({
        vehicle: v,
        items: await Promise.all(
          VEHICLE_SLOTS.map(async (slot) => {
            const row = vRows.find((r) => r.vehicle_id === v.id && r.doc_type === slot.doc_type) ?? null;
            let url: string | null = null;
            if (row?.storage_path) {
              const { data: signed } = await context.supabase.storage
                .from("client-documents")
                .createSignedUrl(row.storage_path, 60 * 30);
              url = signed?.signedUrl ?? null;
            }
            return { ...slot, row, url };
          }),
        ),
      })),
    );

    return {
      clientId: client.id,
      clientType: client.client_type as "individual" | "corporate",
      kycStatus: client.kyc_status as string,
      items,
      vehicleGroups,
      requiredDone,
      requiredTotal,
      canSubmit,
    };
  });

export const recordKycUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    doc_type: z.enum(DOC_TYPE_ENUM),
    storage_path: z.string().min(1),
    file_name: z.string().min(1),
    vehicle_id: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    if (!data.storage_path.startsWith(`${client.id}/kyc/`)) {
      throw new Error("Invalid upload path");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await saveDocRow(supabaseAdmin, {
      client_id: client.id,
      tenant_id: client.tenant_id,
      vehicle_id: data.vehicle_id ?? null,
      doc_type: data.doc_type,
      storage_path: data.storage_path,
      file_name: data.file_name,
      status: "pending",
    });
    // Reset KYC back to pending if it was rejected
    if (client.kyc_status === "rejected") {
      await context.supabase.from("clients").update({ kyc_status: "pending" }).eq("id", client.id);
    }
    await maybeAutoVerifyClientKyc(client.id);
    return row;
  });

export const createKycUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    doc_type: z.enum(DOC_TYPE_ENUM),
    file_name: z.string().min(1),
    vehicle_id: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const safe = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = data.vehicle_id
      ? `${client.id}/kyc/vehicles/${data.vehicle_id}/${data.doc_type}/${Date.now()}-${safe}`
      : `${client.id}/kyc/${data.doc_type}/${Date.now()}-${safe}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("client-documents")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL");
    return { path, token: signed.token, clientId: client.id };
  });

export const staffCreateKycUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    client_id: z.string().uuid(),
    doc_type: z.enum(DOC_TYPE_ENUM),
    file_name: z.string().min(1),
    vehicle_id: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const safe = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = data.vehicle_id
      ? `${data.client_id}/kyc/vehicles/${data.vehicle_id}/${data.doc_type}/${Date.now()}-${safe}`
      : `${data.client_id}/kyc/${data.doc_type}/${Date.now()}-${safe}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("client-documents")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL");
    return { path, token: signed.token };
  });

export const removeKycUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    doc_type: z.enum(DOC_TYPE_ENUM),
    vehicle_id: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data: row } = await vehicleFilter(
      context.supabase
        .from("client_required_documents")
        .select("storage_path")
        .eq("client_id", client.id)
        .eq("doc_type", data.doc_type),
      data.vehicle_id ?? null,
    ).maybeSingle();
    if (row?.storage_path) {
      await context.supabase.storage.from("client-documents").remove([row.storage_path]);
    }
    await vehicleFilter(
      context.supabase
        .from("client_required_documents")
        .delete()
        .eq("client_id", client.id)
        .eq("doc_type", data.doc_type),
      data.vehicle_id ?? null,
    );
    return { ok: true };
  });

export const submitKycForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const required = (client.client_type === "corporate" ? CORPORATE_SLOTS : INDIVIDUAL_SLOTS)
      .filter((s) => s.required)
      .map((s) => s.doc_type);
    const { data: rows, error } = await context.supabase
      .from("client_required_documents")
      .select("doc_type")
      .eq("client_id", client.id)
      .is("vehicle_id", null);
    if (error) throw error;
    const have = new Set((rows ?? []).map((r: any) => r.doc_type));
    const missing = required.filter((t) => !have.has(t));
    if (missing.length > 0) {
      throw new Error(`Please upload all required documents first (missing: ${missing.join(", ")}).`);
    }
    const { error: upErr } = await context.supabase
      .from("clients")
      .update({ kyc_status: "in_review" })
      .eq("id", client.id);
    if (upErr) throw upErr;
    return { ok: true };
  });

// Staff actions
export const listClientKycDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: client, error: cErr } = await context.supabase
      .from("clients")
      .select("id, client_type, kyc_status")
      .eq("id", data.client_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!client) throw new Error("Client not found");
    const slots = [
      ...(client.client_type === "corporate" ? CORPORATE_SLOTS : INDIVIDUAL_SLOTS),
      ...VEHICLE_SLOTS,
    ];
    const { data: rows, error } = await context.supabase
      .from("client_required_documents")
      .select("*")
      .eq("client_id", client.id);
    if (error) throw error;
    const byType = new Map<string, any>((rows ?? []).map((r: any) => [r.doc_type, r]));
    const items = await Promise.all(
      slots.map(async (slot) => {
        const row = byType.get(slot.doc_type);
        let url: string | null = null;
        if (row?.storage_path) {
          const { data: signed } = await context.supabase.storage
            .from("client-documents")
            .createSignedUrl(row.storage_path, 60 * 30);
          url = signed?.signedUrl ?? null;
        }
        return { ...slot, row: row ?? null, url };
      }),
    );
    return { kycStatus: client.kyc_status as string, items };
  });

async function assertStaff(supabase: any, userId: string) {
  const roles = ["admin", "manager", "agent"] as const;
  for (const r of roles) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) return;
  }
  throw new Error("Forbidden: staff role required");
}

export const staffUploadKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    client_id: z.string().uuid(),
    doc_type: z.enum(DOC_TYPE_ENUM),
    storage_path: z.string().min(1),
    file_name: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    if (!data.storage_path.startsWith(`${data.client_id}/kyc/`)) {
      throw new Error("Invalid upload path");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("client_required_documents")
      .select("storage_path, tenant_id")
      .eq("client_id", data.client_id)
      .eq("doc_type", data.doc_type)
      .maybeSingle();
    if (existing?.storage_path && existing.storage_path !== data.storage_path) {
      await supabaseAdmin.storage.from("client-documents").remove([existing.storage_path]);
    }
    let tenantId = existing?.tenant_id as string | undefined;
    if (!tenantId) {
      const { data: c } = await supabaseAdmin.from("clients").select("tenant_id").eq("id", data.client_id).maybeSingle();
      tenantId = (c as any)?.tenant_id;
    }
    const { data: row, error } = await supabaseAdmin
      .from("client_required_documents")
      .upsert(
        {
          client_id: data.client_id,
          tenant_id: tenantId,
          doc_type: data.doc_type,
          storage_path: data.storage_path,
          file_name: data.file_name,
          status: "verified" as const,
          rejection_reason: null,
          verified_at: new Date().toISOString(),
          verified_by: context.userId,
        } as any,
        { onConflict: "client_id,doc_type" },
      )
      .select()
      .single();
    if (error) throw error;
    await maybeAutoVerifyClientKyc(data.client_id);
    return row;
  });

export const verifyKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("client_required_documents")
      .update({ status: "verified", verified_at: new Date().toISOString(), verified_by: context.userId, rejection_reason: null })
      .eq("id", data.id)
      .select("client_id")
      .maybeSingle();
    if (error) throw error;
    if (row?.client_id) await maybeAutoVerifyClientKyc(row.client_id);
    return { ok: true };
  });

export const rejectKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().min(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("client_required_documents")
      .update({ status: "rejected", rejection_reason: data.reason, verified_at: null, verified_by: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setClientKycStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    client_id: z.string().uuid(),
    status: z.enum(["pending","in_review","verified","rejected","expired"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({ kyc_status: data.status })
      .eq("id", data.client_id);
    if (error) throw error;
    return { ok: true };
  });