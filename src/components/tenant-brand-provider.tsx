import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBrand, type MyBrand } from "@/lib/tenants.functions";
import { useCurrentUser } from "@/hooks/use-auth";

const BrandCtx = createContext<MyBrand | null>(null);

export function useTenantBrand() {
  return useContext(BrandCtx);
}

export function TenantBrandProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const fetchBrand = useServerFn(getMyBrand);
  const { data } = useQuery({
    queryKey: ["my-brand", user?.id],
    enabled: !!user,
    queryFn: () => fetchBrand(),
    staleTime: 5 * 60_000,
  });

  const brand = data ?? null;

  const css = useMemo(() => {
    if (!brand) return "";
    const p = brand.brand_primary;
    const s = brand.brand_secondary;
    const a = brand.brand_accent;
    const rules: string[] = [];
    if (p) {
      rules.push(`--primary: ${p}`);
      rules.push(`--ring: ${p}`);
      rules.push(`--sidebar-primary: ${p}`);
      rules.push(`--sidebar-ring: ${p}`);
    }
    if (s) {
      rules.push(`--sidebar: ${s}`);
    }
    if (a) {
      rules.push(`--accent: ${a}`);
    }
    return `:root { ${rules.join("; ")}; }`;
  }, [brand]);

  useEffect(() => {
    if (brand?.name) {
      document.title = brand.name;
    }
  }, [brand?.name]);

  return (
    <BrandCtx.Provider value={brand}>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {children}
    </BrandCtx.Provider>
  );
}
