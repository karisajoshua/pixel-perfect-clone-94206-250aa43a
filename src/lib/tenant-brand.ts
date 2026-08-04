import { supabase } from "@/integrations/supabase/client";

export type TenantBrand = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string | null;
  stamp_url: string | null;
  primary: string;
  secondary: string;
  accent: string;
  /** Payment details printed on quotations / invoices. Empty = not shown. */
  mpesa_till: string;
  mpesa_paybill: string;
  paybill_account: string;
  bank_name: string;
  bank_branch: string;
  bank_account_name: string;
  bank_account_no: string;
  doc_footer_note: string;
  /** Authorized signatory printed on receipts. Empty = fall back to the recorder. */
  signatory_name: string;
  signatory_title: string;
};

/** Neutral defaults — never another agency's details. */
const FALLBACK: TenantBrand = {
  name: "",
  tagline: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  logo_url: null,
  stamp_url: null,
  primary: "#2563eb",
  secondary: "#1e3a8a",
  accent: "#f59e0b",
  mpesa_till: "",
  mpesa_paybill: "",
  paybill_account: "",
  bank_name: "",
  bank_branch: "",
  bank_account_name: "",
  bank_account_no: "",
  doc_footer_note: "",
  signatory_name: "",
  signatory_title: "",
};

let cached: Promise<TenantBrand> | null = null;

export function resetBrandCache() { cached = null; }

export function getCurrentBrand(): Promise<TenantBrand> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return FALLBACK;
      const { data } = await supabase
        .from("tenant_members")
        .select("tenants(*)")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const t: any = (data as any)?.tenants;
      if (!t) return FALLBACK;
      const address = [t.address, t.city, t.country].filter(Boolean).join(", ");
      return {
        name: t.name || "",
        tagline: t.tagline || "",
        address,
        phone: t.contact_phone || "",
        email: t.contact_email || "",
        website: t.website || "",
        logo_url: t.logo_url || null,
        stamp_url: t.stamp_url || null,
        primary: t.brand_primary || FALLBACK.primary,
        secondary: t.brand_secondary || FALLBACK.secondary,
        accent: t.brand_accent || FALLBACK.accent,
        mpesa_till: t.mpesa_till || "",
        mpesa_paybill: t.mpesa_paybill || "",
        paybill_account: t.paybill_account || "",
        bank_name: t.bank_name || "",
        bank_branch: t.bank_branch || "",
        bank_account_name: t.bank_account_name || "",
        bank_account_no: t.bank_account_no || "",
        doc_footer_note: t.doc_footer_note || "",
        signatory_name: t.signatory_name || "",
        signatory_title: t.signatory_title || "",
      };
    } catch {
      return FALLBACK;
    }
  })();
  return cached;
}
