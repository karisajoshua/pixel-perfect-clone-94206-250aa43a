import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WorkflowGraph, TriggerConfig } from "./types";

// ---------- auth helpers ----------

async function assertManager(supabase: any, userId: string) {
  for (const r of ["admin", "manager", "super_admin"] as const) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) return;
  }
  throw new Error("Forbidden: admin or manager role required");
}

async function currentTenant(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("current_tenant_id");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You are not a member of any agency");
  return data as string;
}

/** Loads a workflow through the caller's RLS session — proves tenant membership. */
async function loadOwnWorkflow(supabase: any, id: string) {
  const { data, error } = await supabase.from("workflows").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Workflow not found");
  return data;
}

async function auditAs(supabase: any, tenantId: string, userId: string, action: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await supabase.from("audit_log").insert({ tenant_id: tenantId, user_id: userId, action, entity_type: "workflow", entity_id: entityId, metadata });
}

const graphSchema = z.object({
  nodes: z.array(z.object({ id: z.string().min(1), type: z.string(), label: z.string().optional(), config: z.any().optional() })),
  edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })),
});
const triggerSchema = z.object({ event_type: z.string().min(1), filter: z.any().optional() });

// ---------- CRUD ----------

export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("workflows")
      .select("*, workflow_versions!workflows_current_version_fk(id, version_no, trigger, published_at)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const wf = await loadOwnWorkflow(supabase, data.id);
    const { data: versions } = await supabase
      .from("workflow_versions").select("*").eq("workflow_id", data.id).order("version_no", { ascending: false });
    return { ...wf, versions: versions ?? [] };
  });

export const createWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(2),
      description: z.string().optional(),
      graph: graphSchema,
      trigger: triggerSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const tenantId = await currentTenant(supabase);
    const { validateGraph } = await import("./engine.server");
    const errs = validateGraph(data.graph as WorkflowGraph);
    if (errs.length) throw new Error(errs.join("; "));

    const { data: wf, error } = await supabase
      .from("workflows")
      .insert({ tenant_id: tenantId, name: data.name, description: data.description ?? null, status: "draft", created_by: userId })
      .select("*").single();
    if (error) throw new Error(error.message);
    const { data: ver, error: vErr } = await supabase
      .from("workflow_versions")
      .insert({ workflow_id: wf.id, tenant_id: tenantId, version_no: 1, graph: data.graph, trigger: data.trigger })
      .select("*").single();
    if (vErr) throw new Error(vErr.message);
    await auditAs(supabase, tenantId, userId, "workflow.created", wf.id, { name: data.name });
    return { ...wf, draft_version: ver };
  });

/** Updates metadata and/or saves a new draft version (published versions are immutable). */
export const updateWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(2).optional(),
      description: z.string().nullable().optional(),
      graph: graphSchema.optional(),
      trigger: triggerSchema.optional(),
      change_note: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const wf = await loadOwnWorkflow(supabase, data.id);
    if (data.name !== undefined || data.description !== undefined) {
      const { error } = await supabase.from("workflows")
        .update({ ...(data.name !== undefined ? { name: data.name } : {}), ...(data.description !== undefined ? { description: data.description } : {}) })
        .eq("id", wf.id);
      if (error) throw new Error(error.message);
    }
    let versionId: string | null = null;
    if (data.graph || data.trigger) {
      const { data: latest } = await supabase.from("workflow_versions")
        .select("*").eq("workflow_id", wf.id).order("version_no", { ascending: false }).limit(1).maybeSingle();
      const graph = (data.graph ?? latest?.graph) as WorkflowGraph;
      const trigger = (data.trigger ?? latest?.trigger) as TriggerConfig;
      const { validateGraph } = await import("./engine.server");
      const errs = validateGraph(graph);
      if (errs.length) throw new Error(errs.join("; "));
      if (latest && !latest.published_at) {
        const { error } = await supabase.from("workflow_versions")
          .update({ graph, trigger, change_note: data.change_note ?? latest.change_note }).eq("id", latest.id);
        if (error) throw new Error(error.message);
        versionId = latest.id;
      } else {
        const { data: ver, error } = await supabase.from("workflow_versions")
          .insert({ workflow_id: wf.id, tenant_id: wf.tenant_id, version_no: (latest?.version_no ?? 0) + 1, graph, trigger, change_note: data.change_note ?? null })
          .select("id").single();
        if (error) throw new Error(error.message);
        versionId = ver.id;
      }
    }
    await auditAs(supabase, wf.tenant_id, userId, "workflow.updated", wf.id, { draft_version_id: versionId });
    return { ok: true, draft_version_id: versionId };
  });

/** Publishes the latest draft version: it becomes immutable and current. */
export const publishWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), change_note: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const wf = await loadOwnWorkflow(supabase, data.id);
    const { data: draft } = await supabase.from("workflow_versions")
      .select("*").eq("workflow_id", wf.id).is("published_at", null).order("version_no", { ascending: false }).limit(1).maybeSingle();
    if (!draft) throw new Error("No draft version to publish");
    const { validateGraph } = await import("./engine.server");
    const errs = validateGraph(draft.graph as WorkflowGraph);
    if (errs.length) throw new Error(errs.join("; "));
    const { error } = await supabase.from("workflow_versions")
      .update({ published_at: new Date().toISOString(), published_by: userId, change_note: data.change_note ?? draft.change_note })
      .eq("id", draft.id);
    if (error) throw new Error(error.message);
    const { error: wErr } = await supabase.from("workflows").update({ current_version_id: draft.id }).eq("id", wf.id);
    if (wErr) throw new Error(wErr.message);
    await auditAs(supabase, wf.tenant_id, userId, "workflow.published", wf.id, { version_id: draft.id, version_no: draft.version_no });
    return { ok: true, version_id: draft.id, version_no: draft.version_no };
  });

async function setStatus(context: any, id: string, status: "active" | "paused" | "archived") {
  const { supabase, userId } = context;
  await assertManager(supabase, userId);
  const wf = await loadOwnWorkflow(supabase, id);
  if (status === "active" && !wf.current_version_id) throw new Error("Publish a version before activating");
  const { error } = await supabase.from("workflows").update({ status }).eq("id", wf.id);
  if (error) throw new Error(error.message);
  await auditAs(supabase, wf.tenant_id, userId, `workflow.${status === "active" ? "activated" : status}`, wf.id, {});
  return { ok: true, status };
}

export const activateWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(({ data, context }) => setStatus(context, data.id, "active"));

export const pauseWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(({ data, context }) => setStatus(context, data.id, "paused"));

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const wf = await loadOwnWorkflow(supabase, data.id);
    // Workflows with execution history are archived (history must stay auditable); others are removed.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("workflow_runs").select("id", { count: "exact", head: true }).eq("workflow_id", wf.id);
    if ((count ?? 0) > 0) {
      await supabase.from("workflows").update({ status: "archived" }).eq("id", wf.id);
      await auditAs(supabase, wf.tenant_id, userId, "workflow.archived", wf.id, { reason: "has_runs" });
      return { ok: true, archived: true };
    }
    await auditAs(supabase, wf.tenant_id, userId, "workflow.deleted", wf.id, { name: wf.name });
    const { error } = await supabaseAdmin.from("workflows").delete().eq("id", wf.id).eq("tenant_id", wf.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true, archived: false };
  });

// ---------- execution ----------

/** Manually start a run of the current published version with a synthetic event. */
export const executeWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      client_id: z.string().uuid().optional(),
      entity_type: z.string().optional(),
      entity_id: z.string().uuid().optional(),
      payload: z.record(z.string(), z.any()).optional(),
      run_now: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const wf = await loadOwnWorkflow(supabase, data.id);
    if (!wf.current_version_id) throw new Error("Publish a version first");
    const { supabaseAdmin: adminRaw } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin: any = adminRaw;
    const { data: version } = await supabaseAdmin.from("workflow_versions").select("*").eq("id", wf.current_version_id).single();
    if (!version) throw new Error("Published version not found");
    const trigger = version.trigger as unknown as TriggerConfig;
    const { data: eventId, error: eErr } = await supabaseAdmin.rpc("automation_emit_event", {
      p_tenant_id: wf.tenant_id,
      p_event_type: trigger.event_type,
      p_entity_type: data.entity_type ?? "manual",
      p_entity_id: data.entity_id ?? null,
      p_client_id: data.client_id ?? null,
      p_payload: { ...(data.payload ?? {}), manual: true, triggered_by: userId, only_workflow_id: wf.id },
    });
    if (eErr) throw new Error(eErr.message);
    // Build the run directly (bypassing the matcher) so a manual run targets exactly this workflow.
    const { data: ev } = await supabaseAdmin.from("automation_events").select("*").eq("id", eventId).single();
    if (!ev) throw new Error("Event not recorded");
    const { triggerNode, runTick } = await import("./engine.server");
    let client: any = null;
    if (ev.client_id) {
      const { data: c } = await supabaseAdmin.from("clients")
        .select("id, full_name, company_name, client_type, email, phone").eq("id", ev.client_id).maybeSingle();
      if (c) client = { ...c, display_name: c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name };
    }
    const ctx = {
      tenant_id: wf.tenant_id,
      event: { id: ev.id, type: ev.event_type, entity_type: ev.entity_type, entity_id: ev.entity_id, occurred_at: ev.occurred_at, payload: ev.payload },
      client,
      vars: {},
    };
    const { data: run, error: rErr } = await supabaseAdmin.from("workflow_runs").insert({
      tenant_id: wf.tenant_id, workflow_id: wf.id, version_id: version.id, event_id: ev.id,
      client_id: ev.client_id, entity_type: ev.entity_type, entity_id: ev.entity_id,
      status: "queued", current_node_id: triggerNode(version.graph)?.id ?? null, context: ctx,
      next_run_at: new Date().toISOString(), triggered_by: userId,
    }).select("id").single();
    if (rErr) throw new Error(rErr.message);
    await supabaseAdmin.from("automation_events").update({ processed_at: new Date().toISOString() }).eq("id", ev.id);
    await supabaseAdmin.from("automation_jobs").insert({ tenant_id: wf.tenant_id, run_id: run.id, run_at: new Date().toISOString() });
    await auditAs(supabase, wf.tenant_id, userId, "workflow.manual_execution", wf.id, { run_id: run.id });
    let tick: any = null;
    if (data.run_now) tick = await runTick(supabaseAdmin, { budgetMs: 10_000 });
    return { ok: true, run_id: run.id, tick };
  });

export const getWorkflowRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workflow_id: z.string().uuid().optional(), limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    let q = supabase.from("workflow_runs")
      .select("*, workflows(name), workflow_versions(version_no)")
      .order("created_at", { ascending: false }).limit(data.limit ?? 50);
    if (data.workflow_id) q = q.eq("workflow_id", data.workflow_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getWorkflowRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: run, error } = await supabase.from("workflow_runs")
      .select("*, workflows(name), workflow_versions(version_no, graph)").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!run) throw new Error("Run not found");
    const { data: steps } = await supabase.from("workflow_step_executions").select("*").eq("run_id", data.id).order("started_at");
    const { data: jobs } = await supabase.from("automation_jobs").select("*").eq("run_id", data.id).order("created_at");
    return { ...run, steps: steps ?? [], jobs: jobs ?? [] };
  });

/** Re-queues a failed run from its failed node (a fresh attempt number is used). */
export const retryWorkflowStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ run_id: z.string().uuid(), run_now: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const { data: run } = await supabase.from("workflow_runs").select("*").eq("id", data.run_id).maybeSingle();
    if (!run) throw new Error("Run not found");
    if (run.status !== "failed") throw new Error("Only failed runs can be retried");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Mark the last failed attempt as skipped so the attempt counter resets below the max.
    await supabaseAdmin.from("workflow_step_executions")
      .delete().eq("run_id", run.id).eq("node_id", run.current_node_id).eq("status", "failed");
    await supabaseAdmin.from("workflow_runs")
      .update({ status: "queued", finished_at: null, error: null, next_run_at: new Date().toISOString() }).eq("id", run.id);
    await supabaseAdmin.from("automation_jobs").insert({ tenant_id: run.tenant_id, run_id: run.id, run_at: new Date().toISOString() });
    await auditAs(supabase, run.tenant_id, userId, "workflow.retry", run.workflow_id, { run_id: run.id, node_id: run.current_node_id, manual: true });
    let tick: any = null;
    if (data.run_now) {
      const { runTick } = await import("./engine.server");
      tick = await runTick(supabaseAdmin, { budgetMs: 10_000 });
    }
    return { ok: true, tick };
  });

export const cancelWorkflowRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ run_id: z.string().uuid(), reason: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const { data: run } = await supabase.from("workflow_runs").select("*").eq("id", data.run_id).maybeSingle();
    if (!run) throw new Error("Run not found");
    if (["completed", "failed", "cancelled"].includes(run.status)) throw new Error(`Run is already ${run.status}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("workflow_runs")
      .update({ status: "cancelled", finished_at: new Date().toISOString(), next_run_at: null, error: data.reason ?? "Cancelled by staff" }).eq("id", run.id);
    await supabaseAdmin.from("automation_jobs").update({ status: "cancelled" }).eq("run_id", run.id).in("status", ["pending", "running"]);
    await auditAs(supabase, run.tenant_id, userId, "workflow.cancelled", run.workflow_id, { run_id: run.id, reason: data.reason ?? null });
    return { ok: true };
  });

/** Admin-only: run one scheduler tick immediately (testing aid; cron does this every minute in production). */
export const runAutomationTickNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runTick } = await import("./engine.server");
    return runTick(supabaseAdmin, { budgetMs: 15_000 });
  });

/** Recent automation events for the caller's agency (read via RLS). */
export const listAutomationEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase.from("automation_events")
      .select("id, event_type, entity_type, entity_id, client_id, occurred_at, processed_at, processing_attempts, error")
      .order("occurred_at", { ascending: false }).limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Proof-of-concept: the existing renewal reminder expressed as an engine workflow (created as a draft). */
export const seedRenewalReminderWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: "trigger", type: "trigger", label: "Policy expiring", config: { event_type: "policy.expiring" } },
        {
          id: "has_email", type: "condition", label: "Client has email & ≤ 30 days",
          config: { and: [{ path: "client.email", op: "exists" }, { path: "event.payload.days_to_expiry", op: "less_than_or_equal", value: 30 }] },
        },
        {
          id: "email", type: "send-email", label: "Send renewal reminder",
          config: {
            template: "renewal-reminder",
            to: "{{client.email}}",
            data: {
              clientName: "{{client.display_name}}",
              policyNo: "{{event.payload.policy_no}}",
              endDate: "{{event.payload.end_date}}",
              daysToExpiry: "{{event.payload.days_to_expiry}}",
            },
          },
        },
        { id: "end", type: "end", label: "Done" },
      ],
      edges: [
        { from: "trigger", to: "has_email" },
        { from: "has_email", to: "email", label: "true" },
        { from: "has_email", to: "end", label: "false" },
        { from: "email", to: "end" },
      ],
    };
    return createWorkflow({
      data: {
        name: "Renewal reminder (engine POC)",
        description: "Mirrors the existing daily renewal reminder: policy expiring → email if the client has an address.",
        graph,
        trigger: { event_type: "policy.expiring" },
      },
    } as any);
  });
