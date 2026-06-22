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
  { doc_type: "id_back", label: "National ID — back", description: "Back of your National ID (skip if using a passport).", required: true },
  { doc_type: "kra_pin", label: "KRA PIN certificate", description: "Your personal KRA PIN certificate (PDF preferred).", required: true },
  { doc_type: "proof_of_address", label: "Proof of address", description: "Utility bill or bank statement issued in the last 3 months.", required: true },
  { doc_type: "passport_photo", label: "Passport photo", description: "Recent passport-size photo on a plain background.", required: false },
];

export const CORPORATE_SLOTS: KycSlot[] = [
  { doc_type: "cert_incorporation", label: "Certificate of incorporation", description: "Company registration certificate.", required: true },
  { doc_type: "cr12", label: "CR12 / company registry extract", description: "Issued by the Business Registration Service.", required: true },
  { doc_type: "kra_pin", label: "Company KRA PIN certificate", description: "Company KRA PIN.", required: true },
  { doc_type: "director_id", label: "Director's ID", description: "ID copy of the principal director or authorized signatory.", required: true },
  { doc_type: "proof_of_address", label: "Proof of address", description: "Recent utility bill or bank statement for the business address.", required: true },
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

async function getMyClient(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, client_type, kyc_status, assigned_user_id, full_name, email, branch_id, auth_user_id")
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
    const slots = [...baseSlots, ...VEHICLE_SLOTS];
    const { data: rows, error } = await context.supabase
      .from("client_required_documents")
      .select("id, doc_type, storage_path, file_name, status, rejection_reason, verified_at, created_at, expires_at")
      .eq("client_id", client.id);
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

    return {
      clientId: client.id,
      clientType: client.client_type as "individual" | "corporate",
      kycStatus: client.kyc_status as string,
      items,
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
  }).parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    if (!data.storage_path.startsWith(`${client.id}/kyc/`)) {
      throw new Error("Invalid upload path");
    }
    // Remove previous file for this slot if any
    const { data: existing } = await context.supabase
      .from("client_required_documents")
      .select("storage_path")
      .eq("client_id", client.id)
      .eq("doc_type", data.doc_type)
      .maybeSingle();
    if (existing?.storage_path && existing.storage_path !== data.storage_path) {
      await context.supabase.storage.from("client-documents").remove([existing.storage_path]);
    }
    const { data: row, error } = await context.supabase
      .from("client_required_documents")
      .upsert(
        {
          client_id: client.id,
          doc_type: data.doc_type,
          storage_path: data.storage_path,
          file_name: data.file_name,
          status: "pending" as const,
          rejection_reason: null,
          verified_at: null,
          verified_by: null,
        },
        { onConflict: "client_id,doc_type" },
      )
      .select()
      .single();
    if (error) throw error;
    // Reset KYC back to pending if it was rejected
    if (client.kyc_status === "rejected") {
      await context.supabase.from("clients").update({ kyc_status: "pending" }).eq("id", client.id);
    }
    return row;
  });

export const removeKycUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    doc_type: z.enum(DOC_TYPE_ENUM),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const client = await getMyClient(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("client_required_documents")
      .select("storage_path")
      .eq("client_id", client.id)
      .eq("doc_type", data.doc_type)
      .maybeSingle();
    if (row?.storage_path) {
      await context.supabase.storage.from("client-documents").remove([row.storage_path]);
    }
    await context.supabase
      .from("client_required_documents")
      .delete()
      .eq("client_id", client.id)
      .eq("doc_type", data.doc_type);
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
      .eq("client_id", client.id);
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
    const { data: existing } = await context.supabase
      .from("client_required_documents")
      .select("storage_path")
      .eq("client_id", data.client_id)
      .eq("doc_type", data.doc_type)
      .maybeSingle();
    if (existing?.storage_path && existing.storage_path !== data.storage_path) {
      await context.supabase.storage.from("client-documents").remove([existing.storage_path]);
    }
    const { data: row, error } = await context.supabase
      .from("client_required_documents")
      .upsert(
        {
          client_id: data.client_id,
          doc_type: data.doc_type,
          storage_path: data.storage_path,
          file_name: data.file_name,
          status: "verified" as const,
          rejection_reason: null,
          verified_at: new Date().toISOString(),
          verified_by: context.userId,
        },
        { onConflict: "client_id,doc_type" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const verifyKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("client_required_documents")
      .update({ status: "verified", verified_at: new Date().toISOString(), verified_by: context.userId, rejection_reason: null })
      .eq("id", data.id);
    if (error) throw error;
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