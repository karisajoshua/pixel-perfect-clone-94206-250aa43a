import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipenFetch } from "./ipen-fetch.server";

// Simple in-memory reference-data cache (per worker instance). IPEN
// reference data (countries, vehicle makes, etc.) changes rarely, so a
// short in-process TTL is fine.
type CacheEntry = { at: number; value: any };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await loader();
  CACHE.set(key, { at: Date.now(), value });
  return value;
}

const listSchema = z
  .object({ refresh: z.boolean().optional() })
  .optional()
  .default({});

function makeListFn(key: string, path: string) {
  return createServerFn({ method: "GET" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => listSchema.parse(d ?? {}))
    .handler(async ({ data, context }) => {
      const { supabase, userId } = context as any;
      if (data?.refresh) CACHE.delete(key);
      return cached(key, async () => {
        const res = await ipenFetch<any>(supabase, userId, { path, method: "GET" });
        if (!res.ok) throw new Error(res.error ?? `Failed to load ${key}`);
        return res.data;
      });
    });
}

export const listCountries = makeListFn("countries", "/api/Common/countries");
export const listIdentificationDocuments = makeListFn(
  "id-docs",
  "/api/Common/identification-documents",
);
export const listGenders = makeListFn("genders", "/api/Common/genders");
export const listRiskClassCategories = makeListFn(
  "risk-class-categories",
  "/api/Common/risk-class-categories",
);
export const listVehicleMakes = makeListFn("vehicle-makes", "/api/Common/vehicle-makes");
export const listVehicleModels = makeListFn("vehicle-models", "/api/Common/vehicle-models");
export const listMotorTypes = makeListFn("motor-types", "/api/Common/motor-types");
export const listRelationships = makeListFn("relationships", "/api/Common/relationships");

// customer-vehicles is per-user; do not cache.
export const listCustomerVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Common/customer-vehicles",
      method: "GET",
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to load customer vehicles");
    return res.data;
  });

export const listRiskClasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ riskClassCategoryId: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const key = `risk-classes:${data.riskClassCategoryId}`;
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: `/api/Policy/risk-classes/${encodeURIComponent(String(data.riskClassCategoryId))}`,
        method: "GET",
      });
      if (!res.ok) throw new Error(res.error ?? "Failed to load risk classes");
      return res.data;
    });
  });

export const listCoverOptions = makeListFn("cover-options", "/api/Policy/cover-options");

export const listVehicleUses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        productClass: z.union([z.string(), z.number()]).optional(),
        coverType: z.union([z.string(), z.number()]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Policy/vehicle-uses",
      method: "POST",
      body: data,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to load vehicle uses");
    return res.data;
  });

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ riskClassCategoryId: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: `/api/Policy/products/${encodeURIComponent(String(data.riskClassCategoryId))}`,
      method: "GET",
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to load products");
    return res.data;
  });