/**
 * Automation Engine — server-only executor.
 *
 * Design:
 *  - processEvents(): claims unprocessed automation_events (SKIP LOCKED), matches
 *    active workflows of the same tenant, snapshots the published version into a
 *    workflow_run and queues one automation_job. Unique (event_id, workflow_id)
 *    guarantees a single run per event/workflow even under concurrent ticks.
 *  - executeJobs(): claims due automation_jobs and advances each run node by node.
 *    Delays never block: the run is parked in `waiting` with next_run_at and a job
 *    scheduled for that time. Retries use exponential backoff via the same queue.
 *  - Every node execution is recorded in workflow_step_executions with a unique
 *    idempotency key run_id:node_id:attempt. A completed step is never re-executed.
 */
import { evaluateCondition, interpolate, resolveData } from "./conditions";
import { sendTemplatedEmail } from "./email.server";
import {
  NODE_MAX_ATTEMPTS,
  type Condition,
  type DelayConfig,
  type SendEmailConfig,
  type TriggerConfig,
  type WorkflowGraph,
  type WorkflowNode,
} from "./types";

export const EVENT_BATCH = 25;
export const JOB_BATCH = 25;
const MAX_NODES_PER_INVOCATION = 50;
const BASE_BACKOFF_MS = 30_000;

type Admin = any;

class StepError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.retryable = retryable;
  }
}

export async function audit(
  admin: Admin,
  tenantId: string,
  action: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
  userId: string | null = null,
) {
  try {
    await admin.from("audit_log").insert({
      tenant_id: tenantId,
      user_id: userId,
      action,
      entity_type: "workflow",
      entity_id: entityId,
      metadata,
    });
  } catch (e) {
    console.warn("[automation] audit insert failed", e);
  }
}

// ---------- graph helpers ----------

export function findNode(graph: WorkflowGraph, id: string | null | undefined): WorkflowNode | undefined {
  if (!id) return undefined;
  return graph.nodes.find((n) => n.id === id);
}

export function triggerNode(graph: WorkflowGraph): WorkflowNode | undefined {
  return graph.nodes.find((n) => n.type === "trigger");
}

function nextNodeId(graph: WorkflowGraph, from: string, label?: string): string | null {
  const edges = graph.edges.filter((e) => e.from === from);
  if (label !== undefined) {
    const labelled = edges.find((e) => (e.label ?? "").toLowerCase() === label);
    if (labelled) return labelled.to;
    const unlabelled = edges.find((e) => !e.label);
    return unlabelled?.to ?? null;
  }
  return edges[0]?.to ?? null;
}

export function validateGraph(graph: WorkflowGraph): string[] {
  const errors: string[] = [];
  if (!Array.isArray(graph?.nodes) || !Array.isArray(graph?.edges)) return ["Graph must have nodes and edges arrays"];
  const triggers = graph.nodes.filter((n) => n.type === "trigger");
  if (triggers.length !== 1) errors.push("Graph must contain exactly one trigger node");
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    if (!n.id) errors.push("Every node needs an id");
    if (ids.has(n.id)) errors.push(`Duplicate node id ${n.id}`);
    ids.add(n.id);
    if (!(n.type in NODE_MAX_ATTEMPTS)) errors.push(`Unsupported node type '${n.type}' on ${n.id}`);
    if (n.type === "send-email") {
      const c = n.config as SendEmailConfig | undefined;
      if (!c?.template) errors.push(`send-email node ${n.id} needs a template`);
      if (!c?.to) errors.push(`send-email node ${n.id} needs a recipient`);
    }
    if (n.type === "delay") {
      const c = n.config as DelayConfig | undefined;
      if (!c || !(c.amount > 0) || !["minutes", "hours", "days"].includes(c.unit))
        errors.push(`delay node ${n.id} needs amount and unit (minutes|hours|days)`);
    }
  }
  for (const e of graph.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) errors.push(`Edge ${e.from}->${e.to} references an unknown node`);
  }
  return errors;
}

// ---------- context ----------

async function buildContext(admin: Admin, ev: any) {
  let client: Record<string, unknown> | null = null;
  if (ev.client_id) {
    const { data } = await admin
      .from("clients")
      .select("id, full_name, company_name, client_type, email, phone, branch_id, kyc_status")
      .eq("id", ev.client_id)
      .maybeSingle();
    if (data) {
      client = {
        ...data,
        display_name: data.client_type === "corporate" ? data.company_name ?? data.full_name : data.full_name,
      };
    }
  }
  return {
    tenant_id: ev.tenant_id,
    event: {
      id: ev.id,
      type: ev.event_type,
      entity_type: ev.entity_type,
      entity_id: ev.entity_id,
      occurred_at: ev.occurred_at,
      payload: ev.payload ?? {},
    },
    client,
    vars: {} as Record<string, unknown>,
  };
}

// ---------- 1. events → runs ----------

export async function processEvents(admin: Admin, limit = EVENT_BATCH, deadline = Date.now() + 15_000) {
  const stats = { claimed: 0, runs_created: 0, errors: [] as string[] };
  const { data: events, error } = await admin.rpc("automation_claim_events", { p_limit: limit });
  if (error) {
    stats.errors.push(`claim events: ${error.message}`);
    return stats;
  }
  for (const ev of events ?? []) {
    if (Date.now() > deadline) break;
    stats.claimed += 1;
    try {
      const { data: workflows, error: wErr } = await admin
        .from("workflows")
        .select("id, tenant_id, name, current_version_id, workflow_versions!workflows_current_version_fk(id, graph, trigger)")
        .eq("tenant_id", ev.tenant_id)
        .eq("status", "active")
        .not("current_version_id", "is", null);
      if (wErr) throw new Error(wErr.message);

      const matching = (workflows ?? []).filter((w: any) => {
        const trig = (w.workflow_versions?.trigger ?? {}) as TriggerConfig;
        return trig.event_type === ev.event_type;
      });

      if (matching.length > 0) {
        const ctx = await buildContext(admin, ev);
        for (const w of matching) {
          const version = w.workflow_versions;
          const trig = (version.trigger ?? {}) as TriggerConfig;
          if (!evaluateCondition(trig.filter as Condition | undefined, ctx)) continue;
          const graph = version.graph as WorkflowGraph;
          const start = triggerNode(graph);
          const { data: run, error: rErr } = await admin
            .from("workflow_runs")
            .insert({
              tenant_id: ev.tenant_id,
              workflow_id: w.id,
              version_id: version.id,
              event_id: ev.id,
              client_id: ev.client_id,
              entity_type: ev.entity_type,
              entity_id: ev.entity_id,
              status: "queued",
              current_node_id: start?.id ?? null,
              context: ctx,
              next_run_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (rErr) {
            if (rErr.code === "23505") continue; // already created by a concurrent tick
            throw new Error(rErr.message);
          }
          const { error: jErr } = await admin
            .from("automation_jobs")
            .insert({ tenant_id: ev.tenant_id, run_id: run.id, run_at: new Date().toISOString() });
          if (jErr && jErr.code !== "23505") throw new Error(jErr.message);
          stats.runs_created += 1;
        }
      }
      await admin
        .from("automation_events")
        .update({ processed_at: new Date().toISOString(), error: null, locked_at: null })
        .eq("id", ev.id);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      stats.errors.push(`event ${ev.id}: ${msg}`);
      await admin.from("automation_events").update({ error: msg }).eq("id", ev.id);
    }
  }
  return stats;
}

// ---------- 2. jobs → node execution ----------

export async function executeJobs(admin: Admin, limit = JOB_BATCH, deadline = Date.now() + 15_000) {
  const stats = { claimed: 0, completed: 0, waiting: 0, failed: 0, retried: 0, errors: [] as string[] };
  const { data: jobs, error } = await admin.rpc("automation_claim_jobs", { p_limit: limit });
  if (error) {
    stats.errors.push(`claim jobs: ${error.message}`);
    return stats;
  }
  for (const job of jobs ?? []) {
    if (Date.now() > deadline) {
      // Release unstarted jobs so the next tick picks them up immediately.
      await admin.from("automation_jobs").update({ status: "pending", locked_at: null }).eq("id", job.id);
      continue;
    }
    stats.claimed += 1;
    try {
      const outcome = await executeJob(admin, job);
      stats[outcome] += 1;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      stats.errors.push(`job ${job.id}: ${msg}`);
      await admin.from("automation_jobs").update({ status: "failed", error: msg }).eq("id", job.id);
    }
  }
  return stats;
}

type Outcome = "completed" | "waiting" | "failed" | "retried";

async function executeJob(admin: Admin, job: any): Promise<Outcome> {
  const { data: run, error } = await admin
    .from("workflow_runs")
    .select("*, workflow_versions(graph), workflows(name)")
    .eq("id", job.run_id)
    .single();
  if (error || !run) throw new Error(error?.message ?? "Run not found");

  if (["completed", "failed", "cancelled"].includes(run.status)) {
    await admin.from("automation_jobs").update({ status: "done" }).eq("id", job.id);
    return run.status === "completed" ? "completed" : "failed";
  }

  const graph = run.workflow_versions.graph as WorkflowGraph;
  const ctx = run.context ?? {};
  const { data: priorSteps } = await admin
    .from("workflow_step_executions")
    .select("node_id, attempt, status, output")
    .eq("run_id", run.id)
    .order("attempt", { ascending: true });
  const stepsByNode = new Map<string, any[]>();
  for (const s of priorSteps ?? []) {
    const arr = stepsByNode.get(s.node_id) ?? [];
    arr.push(s);
    stepsByNode.set(s.node_id, arr);
  }

  if (!run.started_at) {
    await admin.from("workflow_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", run.id);
    await audit(admin, run.tenant_id, "workflow.executed", run.workflow_id, {
      run_id: run.id,
      event_id: run.event_id,
      workflow: run.workflows?.name,
    });
  } else {
    await admin.from("workflow_runs").update({ status: "running" }).eq("id", run.id);
  }

  let nodeId: string | null = run.current_node_id ?? triggerNode(graph)?.id ?? null;
  let hops = 0;

  while (nodeId && hops < MAX_NODES_PER_INVOCATION) {
    hops += 1;
    const node = findNode(graph, nodeId);
    if (!node) return await failRun(admin, run, job, nodeId, `Node ${nodeId} not found in graph`);

    const history = stepsByNode.get(node.id) ?? [];
    const done = history.find((s) => s.status === "completed" || s.status === "skipped");

    let next: string | null;
    if (done) {
      // Already executed (resume after delay / crash recovery) — just advance.
      next = done.output?.next ?? nextNodeId(graph, node.id, done.output?.branch);
    } else {
      const attempt = history.length + 1;
      const idem = `${run.id}:${node.id}:${attempt}`;
      const { data: step, error: sErr } = await admin
        .from("workflow_step_executions")
        .insert({
          tenant_id: run.tenant_id,
          run_id: run.id,
          node_id: node.id,
          node_type: node.type,
          attempt,
          status: "running",
          idempotency_key: idem,
          input: { config: node.config ?? null },
        })
        .select("id")
        .single();
      if (sErr) {
        if (sErr.code === "23505") {
          // Another worker holds this step; leave the run to that worker.
          await admin.from("automation_jobs").update({ status: "done", error: "duplicate step claim" }).eq("id", job.id);
          return "retried";
        }
        throw new Error(sErr.message);
      }

      try {
        const result = await runNode(admin, run, node, graph, ctx, idem);
        await admin
          .from("workflow_step_executions")
          .update({ status: result.status, output: result.output, finished_at: new Date().toISOString() })
          .eq("id", step.id);

        if (result.kind === "wait") {
          await admin
            .from("workflow_runs")
            .update({ status: "waiting", current_node_id: node.id, next_run_at: result.until, context: ctx })
            .eq("id", run.id);
          await admin.from("automation_jobs").update({ status: "done" }).eq("id", job.id);
          const { error: jErr } = await admin
            .from("automation_jobs")
            .insert({ tenant_id: run.tenant_id, run_id: run.id, run_at: result.until });
          if (jErr && jErr.code !== "23505") throw new Error(jErr.message);
          return "waiting";
        }
        next = result.output?.next ?? nextNodeId(graph, node.id, result.output?.branch);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        const retryable = e instanceof StepError ? e.retryable : true;
        await admin
          .from("workflow_step_executions")
          .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
          .eq("id", step.id);
        const max = NODE_MAX_ATTEMPTS[node.type] ?? 1;
        if (retryable && attempt < max) {
          const delayMs = BASE_BACKOFF_MS * 2 ** (attempt - 1);
          const at = new Date(Date.now() + delayMs).toISOString();
          await admin
            .from("workflow_runs")
            .update({ status: "queued", current_node_id: node.id, next_run_at: at, error: msg })
            .eq("id", run.id);
          await admin.from("automation_jobs").update({ status: "done", error: msg }).eq("id", job.id);
          await admin.from("automation_jobs").insert({ tenant_id: run.tenant_id, run_id: run.id, run_at: at });
          await audit(admin, run.tenant_id, "workflow.retry", run.workflow_id, {
            run_id: run.id, node_id: node.id, attempt, next_attempt_at: at, error: msg,
          });
          return "retried";
        }
        return await failRun(admin, run, job, node.id, msg);
      }
    }

    if (!next) {
      return await completeRun(admin, run, job, node.id, ctx);
    }
    nodeId = next;
    await admin.from("workflow_runs").update({ current_node_id: nodeId, context: ctx }).eq("id", run.id);
  }

  if (hops >= MAX_NODES_PER_INVOCATION) {
    // Yield: keep the run queued and let the next tick continue.
    await admin.from("workflow_runs").update({ status: "queued", next_run_at: new Date().toISOString() }).eq("id", run.id);
    await admin.from("automation_jobs").update({ status: "done" }).eq("id", job.id);
    await admin.from("automation_jobs").insert({ tenant_id: run.tenant_id, run_id: run.id, run_at: new Date().toISOString() });
    return "retried";
  }
  return await completeRun(admin, run, job, nodeId, ctx);
}

type NodeResult =
  | { kind: "next"; status: "completed" | "skipped"; output: Record<string, any> }
  | { kind: "wait"; status: "completed"; until: string; output: Record<string, any> };

async function runNode(
  admin: Admin,
  run: any,
  node: WorkflowNode,
  graph: WorkflowGraph,
  ctx: any,
  idem: string,
): Promise<NodeResult> {
  switch (node.type) {
    case "trigger":
      return { kind: "next", status: "completed", output: { next: nextNodeId(graph, node.id) } };
    case "end":
      return { kind: "next", status: "completed", output: { next: null } };
    case "condition": {
      const ok = evaluateCondition(node.config as Condition, ctx);
      const branch = ok ? "true" : "false";
      return { kind: "next", status: "completed", output: { result: ok, branch, next: nextNodeId(graph, node.id, branch) } };
    }
    case "delay": {
      const c = node.config as DelayConfig;
      const mult = c.unit === "days" ? 86_400_000 : c.unit === "hours" ? 3_600_000 : 60_000;
      const until = new Date(Date.now() + Math.max(1, Number(c.amount)) * mult).toISOString();
      return { kind: "wait", status: "completed", until, output: { until, next: nextNodeId(graph, node.id) } };
    }
    case "send-email": {
      const c = node.config as SendEmailConfig;
      const to = interpolate(c.to ?? "", ctx).trim();
      const data = (resolveData(c.data ?? {}, ctx) ?? {}) as Record<string, unknown>;
      // Idempotency across retries: the same run+node always yields the same queue key.
      const res = await sendTemplatedEmail(admin, {
        template: c.template,
        to,
        data,
        idempotencyKey: `automation:${run.id}:${node.id}`,
        label: `automation:${c.template}`,
      });
      if (!res.ok) throw new StepError(res.error, res.retryable);
      if ("skipped" in res && res.skipped) {
        return { kind: "next", status: "skipped", output: { to, reason: res.reason, next: nextNodeId(graph, node.id) } };
      }
      void idem;
      return { kind: "next", status: "completed", output: { to, message_id: res.message_id, template: c.template, next: nextNodeId(graph, node.id) } };
    }
    default:
      throw new StepError(`Unsupported node type ${(node as any).type}`, false);
  }
}

async function completeRun(admin: Admin, run: any, job: any, nodeId: string | null, ctx: any): Promise<Outcome> {
  await admin
    .from("workflow_runs")
    .update({ status: "completed", current_node_id: nodeId, finished_at: new Date().toISOString(), next_run_at: null, context: ctx, error: null })
    .eq("id", run.id);
  await admin.from("automation_jobs").update({ status: "done" }).eq("id", job.id);
  await audit(admin, run.tenant_id, "workflow.completed", run.workflow_id, { run_id: run.id });
  return "completed";
}

async function failRun(admin: Admin, run: any, job: any, nodeId: string | null, msg: string): Promise<Outcome> {
  await admin
    .from("workflow_runs")
    .update({ status: "failed", current_node_id: nodeId, finished_at: new Date().toISOString(), next_run_at: null, error: msg })
    .eq("id", run.id);
  await admin.from("automation_jobs").update({ status: "failed", error: msg }).eq("id", job.id);
  await audit(admin, run.tenant_id, "workflow.failed", run.workflow_id, { run_id: run.id, node_id: nodeId, error: msg });
  return "failed";
}

// ---------- 3. one tick ----------

export async function runTick(admin: Admin, opts: { budgetMs?: number } = {}) {
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? 20_000);
  const { data: scanned, error: scanErr } = await admin.rpc("automation_scan_scheduled_events", { p_limit: 200 });
  const events = await processEvents(admin, EVENT_BATCH, deadline);
  const jobs = await executeJobs(admin, JOB_BATCH, deadline);
  return {
    ok: true,
    scheduled_events_created: scanErr ? null : scanned,
    scan_error: scanErr?.message ?? null,
    events,
    jobs,
    duration_ms: Date.now() - started,
  };
}
