import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-auth";

export async function getMyRoles(): Promise<AppRole[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  return (data ?? []).map((r) => r.role as AppRole);
}

export function hasAnyRole(roles: AppRole[], allowed: AppRole[]): boolean {
  return roles.some((r) => allowed.includes(r));
}

export function isClientOnly(roles: AppRole[]): boolean {
  return roles.length > 0 && roles.every((r) => r === "client");
}

export function landingFor(roles: AppRole[]): "/portal" | "/dashboard" {
  return isClientOnly(roles) ? "/portal" : "/dashboard";
}

import { redirect } from "@tanstack/react-router";

export function requireRole(allowed: AppRole[]) {
  return ({ context }: { context: { roles?: string[] } }) => {
    const roles = (context?.roles ?? []) as AppRole[];
    if (!roles.some((r) => allowed.includes(r))) {
      throw redirect({ to: "/dashboard" });
    }
  };
}