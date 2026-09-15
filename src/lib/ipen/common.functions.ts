import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";
import { ipenFetch } from "./ipen-fetch.server";

const listInput = z
  .object({ refresh: z.boolean().optional() })
  .optional()
  .default({});

export const listCountries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { cached, invalidate } = await import("./common-cache.server");
    const { supabase, userId } = context as any;
    const key = "countries";
    if (data?.refresh) invalidate(key);
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: "/api/Common/countries",
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? `Failed to load ${key}` };
      return res.data;
    });
  });

export const listIdentificationDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { cached, invalidate } = await import("./common-cache.server");
    const { supabase, userId } = context as any;
    const key = "id-docs";
    if (data?.refresh) invalidate(key);
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: "/api/Common/identification-documents",
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? `Failed to load ${key}` };
      return res.data;
    });
  });

export const listGenders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { cached, invalidate } = await import("./common-cache.server");
    const { supabase, userId } = context as any;
    const key = "genders";
    if (data?.refresh) invalidate(key);
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: "/api/Common/genders",
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? `Failed to load ${key}` };
      return res.data;
    });
  });

export const listRiskClassCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { cached, invalidate } = await import("./common-cache.server");
    const { supabase, userId } = context as any;
    const key = "risk-class-categories";
    if (data?.refresh) invalidate(key);
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: "/api/Common/risk-class-categories",
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? `Failed to load ${key}` };
      return res.data;
    });
  });

export const listVehicleMakes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { cached, invalidate } = await import("./common-cache.server");
    const { supabase, userId } = context as any;
    const key = "vehicle-makes";
    if (data?.refresh) invalidate(key);
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: "/api/Common/vehicle-makes",
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? `Failed to load ${key}` };
      return res.data;
    });
  });

export const listVehicleModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { cached, invalidate } = await import("./common-cache.server");
    const { supabase, userId } = context as any;
    const key = "vehicle-models";
    if (data?.refresh) invalidate(key);
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: "/api/Common/vehicle-models",
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? `Failed to load ${key}` };
      return res.data;
    });
  });

export const listMotorTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { cached, invalidate } = await import("./common-cache.server");
    const { supabase, userId } = context as any;
    const key = "motor-types";
    if (data?.refresh) invalidate(key);
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: "/api/Common/motor-types",
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? `Failed to load ${key}` };
      return res.data;
    });
  });

export const listRelationships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { cached, invalidate } = await import("./common-cache.server");
    const { supabase, userId } = context as any;
    const key = "relationships";
    if (data?.refresh) invalidate(key);
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: "/api/Common/relationships",
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? `Failed to load ${key}` };
      return res.data;
    });
  });

// customer-vehicles is per-user; do not cache.
export const listCustomerVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenFetch<any>(supabase, userId, {
      path: "/api/Common/customer-vehicles",
      method: "GET",
    });
    if (!res.ok) return { data: [], error: res.error ?? "Failed to load customer vehicles" };
    return res.data;
  });

export const listRiskClasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ riskClassCategoryId: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { cached } = await import("./common-cache.server");
    const key = `risk-classes:${data.riskClassCategoryId}`;
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: `/api/Policy/risk-classes/${encodeURIComponent(String(data.riskClassCategoryId))}`,
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? "Failed to load risk classes" };
      return res.data;
    });
  });

export const listCoverOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { cached, invalidate } = await import("./common-cache.server");
    const { supabase, userId } = context as any;
    const key = "cover-options";
    if (data?.refresh) invalidate(key);
    return cached(key, async () => {
      const res = await ipenFetch<any>(supabase, userId, {
        path: "/api/Policy/cover-options",
        method: "GET",
      });
      if (!res.ok) return { data: [], error: res.error ?? `Failed to load ${key}` };
      return res.data;
    });
  });

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
    if (!res.ok) return { data: [], error: res.error ?? "Failed to load vehicle uses" };
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
    if (!res.ok) return { data: [], error: res.error ?? "Failed to load products" };
    return res.data;
  });

// Simple upstream health probe (no auth). Used by the admin panel status pill.
export const ipenHealthCheck = createServerFn({ method: "GET" })
  .handler(async () => {
    const { ipenPublic } = await import("./ipen-fetch.server");
    const res = await ipenPublic<any>({ path: "/health", method: "GET", noAuth: true });
    return { ok: res.ok, status: res.status };
  });