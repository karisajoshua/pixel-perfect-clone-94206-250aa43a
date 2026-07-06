import { supabase } from "@/integrations/supabase/client";

export type TenantBrand = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string | null;
  primary: string;
  secondary: string;
  accent: string;
};

const FALLBACK: TenantBrand = {
  name: "Zest Insurance Agency",
  tagline: "Insurance Brokerage & Advisory",
  address: "Ruai, Miranje Hse, Nairobi, Kenya",
  phone: "+254 713 985 230",
  email: "info@zestinsurance.co.ke",
  website: "www.zestinsurance.co.ke",
  logo_url: null,
  primary: "#2563eb",
  secondary: "#1e3a8a",
  accent: "#f59e0b",
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
        .select("tenants(name, tagline, address, city, country, contact_phone, contact_email, logo_url, brand_primary, brand_secondary, brand_accent, slug)")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const t: any = (data as any)?.tenants;
      if (!t) return FALLBACK;
      const address = [t.address, t.city, t.country].filter(Boolean).join(", ") || FALLBACK.address;
      return {
        name: t.name || FALLBACK.name,
        tagline: t.tagline || FALLBACK.tagline,
        address,
        phone: t.contact_phone || FALLBACK.phone,
        email: t.contact_email || FALLBACK.email,
        website: FALLBACK.website,
        logo_url: t.logo_url || null,
        primary: t.brand_primary || FALLBACK.primary,
        secondary: t.brand_secondary || FALLBACK.secondary,
        accent: t.brand_accent || FALLBACK.accent,
      };
    } catch {
      return FALLBACK;
    }
  })();
  return cached;
}
