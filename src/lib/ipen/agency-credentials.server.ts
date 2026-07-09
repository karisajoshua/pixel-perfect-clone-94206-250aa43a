import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AgencyCredentialRow = Database["public"]["Tables"]["ipen_agency_credentials"]["Row"];
type UserCredentialRow = Database["public"]["Tables"]["ipen_credentials"]["Row"];

export type StoredIpenCredential = {
  scope: "agency" | "user";
  tenant_id: string | null;
  user_id: string | null;
  connected_by?: string | null;
  ipen_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  mfa_token: string | null;
  mfa_required: boolean | null;
  last_login_at: string | null;
};

export type TokenPatch = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number | null;
};

export async function getTenantMembership(userId: string): Promise<{ tenant_id: string; role: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { tenant_id: string; role: string } | null;
}

export async function requireAgencyIpenManager(userId: string): Promise<{ tenant_id: string; role: string }> {
  const member = await getTenantMembership(userId);
  if (!member?.tenant_id) {
    throw new Error("Your account is not assigned to an agency. Complete agency setup first.");
  }
  if (!["admin", "manager"].includes(member.role)) {
    throw new Error("Only admins and managers can manage the agency IPEN connection.");
  }
  return member;
}

export async function loadIpenCredentialForUser(userId: string): Promise<StoredIpenCredential | null> {
  const member = await getTenantMembership(userId);
  if (member?.tenant_id) {
    const { data, error } = await supabaseAdmin
      .from("ipen_agency_credentials")
      .select(
        "tenant_id, connected_by, ipen_email, access_token, refresh_token, token_expires_at, mfa_token, mfa_required, last_login_at",
      )
      .eq("tenant_id", member.tenant_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return agencyRowToCredential(data as AgencyCredentialRow);
  }

  const { data, error } = await supabaseAdmin
    .from("ipen_credentials")
    .select(
      "user_id, ipen_email, access_token, refresh_token, token_expires_at, mfa_token, mfa_required, last_login_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? userRowToCredential(data as UserCredentialRow) : null;
}

export async function upsertAgencyIpenCredential(
  userId: string,
  values: {
    ipen_email: string;
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
    mfa_token: string | null;
    mfa_required: boolean;
    last_login_at: string | null;
  },
): Promise<void> {
  const member = await requireAgencyIpenManager(userId);
  const { error } = await supabaseAdmin.from("ipen_agency_credentials").upsert(
    {
      tenant_id: member.tenant_id,
      connected_by: userId,
      ...values,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(error.message);
}

export async function updateStoredIpenCredential(
  credential: StoredIpenCredential,
  patch: Partial<
    Pick<
      StoredIpenCredential,
      "access_token" | "refresh_token" | "token_expires_at" | "mfa_token" | "mfa_required" | "last_login_at" | "ipen_email"
    >
  >,
): Promise<void> {
  if (credential.scope === "agency") {
    if (!credential.tenant_id) throw new Error("Agency IPEN credential is missing its agency id");
    const { error } = await supabaseAdmin
      .from("ipen_agency_credentials")
      .update(patch)
      .eq("tenant_id", credential.tenant_id);
    if (error) throw new Error(error.message);
    return;
  }

  if (!credential.user_id) throw new Error("IPEN credential is missing its user id");
  const { error } = await supabaseAdmin
    .from("ipen_credentials")
    .update(patch)
    .eq("user_id", credential.user_id);
  if (error) throw new Error(error.message);
}

export async function persistIpenTokenRefresh(credential: StoredIpenCredential, tokens: TokenPatch): Promise<void> {
  const patch: Partial<StoredIpenCredential> = {};
  if (tokens.accessToken) patch.access_token = tokens.accessToken;
  if (tokens.refreshToken) patch.refresh_token = tokens.refreshToken;
  if (tokens.expiresIn) {
    patch.token_expires_at = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
  }
  if (Object.keys(patch).length === 0) return;
  await updateStoredIpenCredential(credential, patch);
}

export async function deleteAgencyIpenCredential(userId: string): Promise<void> {
  const member = await requireAgencyIpenManager(userId);
  const { error } = await supabaseAdmin
    .from("ipen_agency_credentials")
    .delete()
    .eq("tenant_id", member.tenant_id);
  if (error) throw new Error(error.message);
}

function agencyRowToCredential(row: AgencyCredentialRow): StoredIpenCredential {
  return {
    scope: "agency",
    tenant_id: row.tenant_id,
    user_id: null,
    connected_by: row.connected_by,
    ipen_email: row.ipen_email,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_expires_at: row.token_expires_at,
    mfa_token: row.mfa_token,
    mfa_required: row.mfa_required,
    last_login_at: row.last_login_at,
  };
}

function userRowToCredential(row: UserCredentialRow): StoredIpenCredential {
  return {
    scope: "user",
    tenant_id: null,
    user_id: row.user_id,
    ipen_email: row.ipen_email,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_expires_at: row.token_expires_at,
    mfa_token: row.mfa_token,
    mfa_required: row.mfa_required,
    last_login_at: row.last_login_at,
  };
}