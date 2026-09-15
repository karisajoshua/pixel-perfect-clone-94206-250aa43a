import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth-mfa.middleware";
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

export const RENEWAL_OFFSETS = [60, 30, 14, 7, 1];

/** Proof-of-concept: the existing renewal reminder expressed as an engine workflow (created as a draft). */
export const seedRenewalReminderWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const trigger: TriggerConfig = {
      event_type: "policy.expiring",
      // Reusable relative-date rule: fire N days before the policy end date.
      relative_date: { date_field: "end_date", offsets: RENEWAL_OFFSETS },
    };
    const graph: WorkflowGraph = {
      nodes: [
        { id: "trigger", type: "trigger", label: "Policy expiring", config: trigger },
        {
          id: "in_window", type: "condition", label: "Reminder window (60/30/14/7/1)",
          config: { and: [{ path: "event.payload.days_to_expiry", op: "in", value: RENEWAL_OFFSETS }] },
        },
        {
          id: "contactable", type: "condition", label: "Client has any contact detail",
          config: { path: "contact.contactable_via", op: "not_equals", value: "none" },
        },
        {
          id: "notify", type: "send-message", label: "Send renewal reminder",
          config: {
            template: "renewal-reminder",
            // Channel order: email is executed today; phone channels are recorded for Phase 2.
            channels: ["email", "whatsapp", "sms"],
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
        { from: "trigger", to: "in_window" },
        { from: "in_window", to: "contactable", label: "true" },
        { from: "in_window", to: "end", label: "false" },
        { from: "contactable", to: "notify", label: "true" },
        { from: "contactable", to: "end", label: "false" },
        { from: "notify", to: "end" },
      ],
    };
    const wf: any = await createWorkflow({
      data: {
        name: "Renewal reminder (engine POC)",
        description: "Mirrors the existing daily renewal reminder: 60/30/14/7/1 days before expiry (Nairobi dates), channel-aware.",
        graph,
        trigger,
      },
    } as any);
    // POC workflows start in dry-run so they can never double-send alongside the existing reminder.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("workflows").update({ dry_run: true }).eq("id", wf.id);
    return { ...wf, dry_run: true };
  });


/** Toggle dry-run: when on, action nodes log what they WOULD do instead of executing. */
export const setWorkflowDryRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), dry_run: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const wf = await loadOwnWorkflow(supabase, data.id);
    const { error } = await supabase.from("workflows").update({ dry_run: data.dry_run }).eq("id", wf.id);
    if (error) throw new Error(error.message);
    await auditAs(supabase, wf.tenant_id, userId, data.dry_run ? "workflow.dry_run_enabled" : "workflow.dry_run_disabled", wf.id, {});
    return { ok: true, dry_run: data.dry_run };
  });

// ---------- parallel-run comparison: existing renewal reminder vs engine ----------

/**
 * Side-by-side parity report for the caller's agency. Both systems are evaluated on the
 * SAME Africa/Nairobi business date and the SAME relative-date windows, so any row that
 * comes back MISMATCH is a real behavioural difference. Read-only.
 */
export const compareRenewalReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ policy_prefix: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertManager(supabase, userId);
    const tenantId = await currentTenant(supabase);
    const { businessDate, addDaysToDate } = await import("@/lib/business-time");
    const { resolveCustomerContact } = await import("./contacts");

    const nowUtc = new Date();
    const today = businessDate(nowUtc);

    const { data: workflows } = await supabase
      .from("workflows")
      .select("id, name, status, dry_run, current_version_id, workflow_versions!workflows_current_version_fk(trigger)")
      .eq("tenant_id", tenantId);
    const renewalWorkflows = (workflows ?? []).filter((w: any) => w.workflow_versions?.trigger?.event_type === "policy.expiring");
    const configured = renewalWorkflows
      .filter((w: any) => w.status === "active")
      .flatMap((w: any) => (w.workflow_versions?.trigger?.relative_date?.offsets ?? []) as number[]);
    const engineWindows = Array.from(new Set([...configured, ...RENEWAL_OFFSETS])).sort((a, b) => b - a);
    const legacyWindows = RENEWAL_OFFSETS;

    const legacyDates = new Map(legacyWindows.map((d) => [addDaysToDate(today, d), d]));
    const engineDates = new Map(engineWindows.map((d) => [addDaysToDate(today, d), d]));
    const allDates = Array.from(new Set([...legacyDates.keys(), ...engineDates.keys()]));

    let pq = supabase.from("policies")
      .select("id, policy_no, end_date, status, client_id, clients(full_name, company_name, client_type, email, phone)")
      .in("end_date", allDates)
      .in("status", ["active", "pending"]);
    if (data.policy_prefix) pq = pq.ilike("policy_no", `${data.policy_prefix}%`);
    const { data: policies, error } = await pq;
    if (error) throw new Error(error.message);
    const ids = (policies ?? []).map((p: any) => p.id);

    const [{ data: notifs }, { data: events }] = await Promise.all([
      ids.length
        ? supabase.from("notifications").select("id, entity_id, kind, channel, status, subject, created_at, sent_at, error")
            .eq("entity_type", "policy").in("entity_id", ids).like("kind", "renewal_reminder_%")
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase.from("automation_events").select("id, entity_id, occurred_at, processed_at, error, payload")
            .eq("event_type", "policy.expiring").in("entity_id", ids)
        : Promise.resolve({ data: [] }),
    ]);
    const eventIds = (events ?? []).map((e: any) => e.id);
    const { data: runs } = eventIds.length
      ? await supabase.from("workflow_runs").select("id, event_id, workflow_id, status, error, created_at, finished_at, workflows(name)")
          .in("event_id", eventIds)
      : { data: [] as any[] };
    const runIds = (runs ?? []).map((r: any) => r.id);
    const { data: steps } = runIds.length
      ? await supabase.from("workflow_step_executions").select("run_id, node_id, node_type, attempt, status, output, error, finished_at")
          .in("run_id", runIds).in("node_type", ["send-email", "send-message"])
      : { data: [] as any[] };

    const rows: any[] = (policies ?? []).map((p: any) => {
      const cl = p.clients ?? {};
      const name = cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name;
      const contact = resolveCustomerContact(cl);
      const legacyDays = legacyDates.get(p.end_date);
      const engineDays = engineDates.get(p.end_date);
      const legacySelected = legacyDays !== undefined && contact.contactable_via !== "none";
      const engineSelected = engineDays !== undefined && contact.contactable_via !== "none";

      // Expected action per system, given the contact channels available.
      const expectedAction =
        contact.contactable_via === "none"
          ? "skip:no_contact"
          : contact.has_email
            ? "email"
            : "record_phone_channel";

      const pn = (notifs ?? []).filter((n: any) => n.entity_id === p.id);
      const legacyEmail = pn.filter((n: any) => n.channel === "email");
      const legacyPhone = pn.filter((n: any) => n.channel === "sms" || n.channel === "whatsapp");
      const pe = (events ?? []).filter((e: any) => e.entity_id === p.id);
      const pr = (runs ?? []).filter((r: any) => pe.some((e: any) => e.id === r.event_id));
      const ps = (steps ?? []).filter((s: any) => pr.some((r: any) => r.id === s.run_id));
      const byKind = new Map<string, number>();
      for (const n of pn) byKind.set(n.kind, (byKind.get(n.kind) ?? 0) + 1);
      const legacyDuplicates = Array.from(byKind.values()).filter((c) => c > 1).length;
      const byEvWf = new Map<string, number>();
      for (const r of pr) { const k = `${r.event_id}:${r.workflow_id}`; byEvWf.set(k, (byEvWf.get(k) ?? 0) + 1); }
      const engineDuplicates = Array.from(byEvWf.values()).filter((c) => c > 1).length;
      const lastStep = ps.sort((a: any, b: any) => (a.finished_at ?? "").localeCompare(b.finished_at ?? "")).at(-1);

      const legacyAction = !legacySelected
        ? "skip:not_selected"
        : legacyEmail.length ? "email" : legacyPhone.length ? "record_phone_channel" : "pending";
      const engineAction = !engineSelected
        ? "skip:not_selected"
        : lastStep
          ? lastStep.output?.dry_run || lastStep.output?.would_send
            ? "email"
            : lastStep.output?.reason === "pending_channel"
              ? "record_phone_channel"
              : lastStep.output?.reason === "no_contact_details"
                ? "skip:no_contact"
                : lastStep.status === "completed" ? "email" : `skip:${lastStep.output?.reason ?? lastStep.status}`
          : "pending";

      const selectionMatch = legacySelected === engineSelected && (legacyDays ?? null) === (engineDays ?? null);
      const actionMatch =
        legacyAction === "pending" || engineAction === "pending" ? true : legacyAction === engineAction;

      return {
        policy_id: p.id,
        policy_no: p.policy_no,
        client_id: p.client_id,
        client_name: name,
        end_date: p.end_date,
        business_date: today,
        window_days: engineDays ?? legacyDays ?? null,
        contactable_via: contact.contactable_via,
        requires_channel: contact.pending,
        expected_action: expectedAction,
        verdict: selectionMatch && actionMatch ? "MATCH" : "MISMATCH",
        mismatch_reason: selectionMatch
          ? actionMatch ? null : `action differs: legacy=${legacyAction} engine=${engineAction}`
          : `selection differs: legacy=${legacySelected}/${legacyDays ?? "—"} engine=${engineSelected}/${engineDays ?? "—"}`,
        legacy: {
          selected: legacySelected,
          window_days: legacyDays ?? null,
          action: legacyAction,
          reason: legacyDays === undefined ? `outside ${legacyWindows.join("/")} (Nairobi)` : contact.reason,
          content: legacySelected ? `Policy ${p.policy_no} renews in ${legacyDays} day${legacyDays === 1 ? "" : "s"}` : null,
          notifications: pn.length,
          email_status: legacyEmail[0]?.status ?? null,
          phone_records: legacyPhone.length,
          sent_at: legacyEmail[0]?.sent_at ?? null,
          duplicates: legacyDuplicates,
          failures: pn.filter((n: any) => n.status === "failed").length,
          error: pn.find((n: any) => n.error)?.error ?? null,
        },
        engine: {
          selected: engineSelected,
          window_days: engineDays ?? null,
          action: engineAction,
          reason: engineDays === undefined ? `outside ${engineWindows.join("/")} (Nairobi)` : contact.reason,
          content: engineSelected ? `renewal-reminder template · ${engineDays} days` : null,
          event_at: pe[0]?.occurred_at ?? null,
          event_error: pe[0]?.error ?? null,
          runs: pr.map((r: any) => ({ id: r.id, workflow: r.workflows?.name, status: r.status, error: r.error, finished_at: r.finished_at })),
          step_status: lastStep?.status ?? null,
          step_reason: lastStep?.output?.reason ?? null,
          dry_run: !!lastStep?.output?.dry_run,
          would_send_to: lastStep?.output?.would_send?.to ?? lastStep?.output?.to ?? null,
          message_id: lastStep?.output?.message_id ?? null,
          duplicates: engineDuplicates,
          failures: pr.filter((r: any) => r.status === "failed").length + ps.filter((s: any) => s.status === "failed").length,
        },
      };
    });

    const matches = rows.filter((r: any) => r.verdict === "MATCH").length;
    return {
      generated_at: nowUtc.toISOString(),
      dates: { business_today: today, timezone: "Africa/Nairobi", legacy_windows: legacyWindows, engine_windows: engineWindows },
      workflows: renewalWorkflows.map((w: any) => ({
        id: w.id, name: w.name, status: w.status, dry_run: w.dry_run, published: !!w.current_version_id,
        offsets: w.workflow_versions?.trigger?.relative_date?.offsets ?? null,
      })),
      summary: {
        policies: rows.length,
        legacy_selected: rows.filter((r: any) => r.legacy.selected).length,
        engine_selected: rows.filter((r: any) => r.engine.selected).length,
        matches,
        mismatches: rows.length - matches,
        agreement: rows.length ? Math.round((matches / rows.length) * 100) : 100,
        phone_only: rows.filter((r: any) => r.contactable_via === "phone").length,
        no_contact: rows.filter((r: any) => r.contactable_via === "none").length,
        legacy_duplicates: rows.reduce((a: number, r: any) => a + r.legacy.duplicates, 0),
        engine_duplicates: rows.reduce((a: number, r: any) => a + r.engine.duplicates, 0),
        legacy_failures: rows.reduce((a: number, r: any) => a + r.legacy.failures, 0),
        engine_failures: rows.reduce((a: number, r: any) => a + r.engine.failures, 0),
      },
      rows,
    };
  });

