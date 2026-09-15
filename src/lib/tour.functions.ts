import { createServerFn } from "@tanstack/react-start";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";

export const getTourProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await (supabase as any)
      .from("user_tour_progress")
      .select("tour_id,status,last_step")
      .eq("user_id", userId);
    return (data ?? []) as { tour_id: string; status: string; last_step: number }[];
  });

export const saveTourProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tourId: string; status: "pending" | "in_progress" | "skipped" | "completed"; lastStep?: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      tour_id: data.tourId,
      status: data.status,
      last_step: data.lastStep ?? 0,
      completed_at: data.status === "completed" ? new Date().toISOString() : null,
    };
    const { error } = await (supabase as any)
      .from("user_tour_progress")
      .upsert(row, { onConflict: "user_id,tour_id" });
    if (error) throw error;
    return { ok: true };
  });