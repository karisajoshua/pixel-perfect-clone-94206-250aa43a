import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { requireRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listWorkflows, publishWorkflow, activateWorkflow, pauseWorkflow, deleteWorkflow, executeWorkflow,
  getWorkflowRuns, getWorkflowRun, retryWorkflowStep, cancelWorkflowRun, runAutomationTickNow,
  listAutomationEvents, seedRenewalReminderWorkflow, setWorkflowDryRun, compareRenewalReminders,
} from "@/lib/automation/workflows.functions";

export const Route = createFileRoute("/_authenticated/admin/automation")({
  beforeLoad: requireRole(["admin", "manager"]),
  head: () => ({ meta: [{ title: "Automation engine — Admin" }, { name: "description", content: "Internal Phase 1 automation engine: workflows, runs and events." }] }),
  component: AutomationAdmin,
});

const statusVariant = (s: string) =>
  s === "active" || s === "completed" ? "default" : s === "failed" ? "destructive" : "secondary";

function AutomationAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listWorkflows);
  const runs = useServerFn(getWorkflowRuns);
  const events = useServerFn(listAutomationEvents);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const workflowsQ = useQuery({ queryKey: ["automation", "workflows"], queryFn: () => list() });
  const runsQ = useQuery({ queryKey: ["automation", "runs"], queryFn: () => runs({ data: { limit: 50 } }), refetchInterval: 10_000 });
  const eventsQ = useQuery({ queryKey: ["automation", "events"], queryFn: () => events({ data: { limit: 30 } }), refetchInterval: 15_000 });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["automation"] });
  const act = (fn: any, label: string) =>
    useMutation({
      mutationFn: (vars: any) => fn({ data: vars }),
      onSuccess: () => { toast.success(label); invalidate(); },
      onError: (e: any) => toast.error(e?.message ?? `${label} failed`),
    });

  const publish = act(useServerFn(publishWorkflow), "Version published");
  const activate = act(useServerFn(activateWorkflow), "Workflow activated");
  const pause = act(useServerFn(pauseWorkflow), "Workflow paused");
  const remove = act(useServerFn(deleteWorkflow), "Workflow removed");
  const execute = act(useServerFn(executeWorkflow), "Manual run started");
  const retry = act(useServerFn(retryWorkflowStep), "Run re-queued");
  const cancel = act(useServerFn(cancelWorkflowRun), "Run cancelled");
  const seed = act(useServerFn(seedRenewalReminderWorkflow), "Sample workflow created (draft, dry-run)");
  const dryRun = act(useServerFn(setWorkflowDryRun), "Dry-run setting saved");
  const tickFn = useServerFn(runAutomationTickNow);
  const tick = useMutation({
    mutationFn: () => tickFn(),
    onSuccess: (r: any) => { toast.success(`Tick done in ${r.duration_ms} ms — ${r.events.runs_created} runs created, ${r.jobs.completed} completed`); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Tick failed"),
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Automation engine"
        subtitle="Phase 1 internal console — workflows, execution history and captured events."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => seed.mutate({})} disabled={seed.isPending}>Create sample workflow</Button>
            <Button onClick={() => tick.mutate()} disabled={tick.isPending}>Run tick now</Button>
          </div>
        }
      />

      <Card className="overflow-x-auto">
        <div className="px-4 py-3 border-b font-medium">Workflows</div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Trigger</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Version</th><th className="px-4 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {workflowsQ.data?.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No workflows yet. Create the sample to start testing.</td></tr>}
            {workflowsQ.data?.map((w: any) => {
              const cur = w.workflow_versions;
              return (
                <tr key={w.id} className="border-b last:border-0 align-top">
                  <td className="px-4 py-2"><div className="font-medium">{w.name}</div><div className="text-xs text-muted-foreground">{w.description}</div></td>
                  <td className="px-4 py-2 font-mono text-xs">{cur?.trigger?.event_type ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
                      {w.dry_run && <Badge variant="outline">dry-run</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">{cur ? `v${cur.version_no}` : "unpublished"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => publish.mutate({ id: w.id })}>Publish draft</Button>
                      {w.status !== "active"
                        ? <Button size="sm" variant="outline" onClick={() => activate.mutate({ id: w.id })} disabled={!w.current_version_id}>Activate</Button>
                        : <Button size="sm" variant="outline" onClick={() => pause.mutate({ id: w.id })}>Pause</Button>}
                      <Button size="sm" variant="outline" disabled={!w.current_version_id} onClick={() => execute.mutate({ id: w.id, run_now: true, payload: { manual_test: true } })}>Run manually</Button>
                      <Button size="sm" variant={w.dry_run ? "secondary" : "outline"} onClick={() => {
                        if (w.dry_run && !confirm("Turn dry-run OFF? This workflow will start sending real emails.")) return;
                        dryRun.mutate({ id: w.id, dry_run: !w.dry_run });
                      }}>{w.dry_run ? "Dry-run: on" : "Dry-run: off"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove this workflow?")) remove.mutate({ id: w.id }); }}>Remove</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto">
        <div className="px-4 py-3 border-b font-medium">Recent runs</div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="px-4 py-2">Started</th><th className="px-4 py-2">Workflow</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Node</th><th className="px-4 py-2">Next run</th><th className="px-4 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {runsQ.data?.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No runs yet.</td></tr>}
            {runsQ.data?.map((r: any) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2 whitespace-nowrap">{format(new Date(r.created_at), "PP p")}</td>
                <td className="px-4 py-2">{r.workflows?.name} <span className="text-xs text-muted-foreground">v{r.workflow_versions?.version_no}</span></td>
                <td className="px-4 py-2"><Badge variant={statusVariant(r.status)}>{r.status}</Badge>{r.error && <div className="text-xs text-destructive max-w-xs truncate" title={r.error}>{r.error}</div>}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.current_node_id ?? "—"}</td>
                <td className="px-4 py-2 text-xs whitespace-nowrap">{r.next_run_at ? format(new Date(r.next_run_at), "PP p") : "—"}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setOpenRun(openRun === r.id ? null : r.id)}>{openRun === r.id ? "Hide" : "Steps"}</Button>
                    {r.status === "failed" && <Button size="sm" variant="outline" onClick={() => retry.mutate({ run_id: r.id, run_now: true })}>Retry</Button>}
                    {["queued", "running", "waiting"].includes(r.status) && <Button size="sm" variant="outline" onClick={() => cancel.mutate({ run_id: r.id })}>Cancel</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {openRun && <RunSteps id={openRun} />}
      </Card>

      <ParallelRun />

      <Card className="overflow-x-auto">
        <div className="px-4 py-3 border-b font-medium">Recent events</div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Event</th><th className="px-4 py-2">Entity</th><th className="px-4 py-2">Processed</th></tr></thead>
          <tbody>
            {eventsQ.data?.map((e: any) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="px-4 py-2 whitespace-nowrap">{format(new Date(e.occurred_at), "PP p")}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.event_type}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{e.entity_type} {e.entity_id?.slice(0, 8)}</td>
                <td className="px-4 py-2 text-xs">{e.processed_at ? "yes" : e.error ? <span className="text-destructive">{e.error}</span> : "pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ParallelRun() {
  const compare = useServerFn(compareRenewalReminders);
  const [prefix, setPrefix] = useState("");
  const q = useQuery({
    queryKey: ["automation", "parallel-run", prefix],
    queryFn: () => compare({ data: prefix ? { policy_prefix: prefix } : {} }),
    refetchInterval: 15_000,
  });
  const d: any = q.data;
  const mark = (ok: boolean | null | undefined, label?: string) =>
    ok == null ? <span className="text-muted-foreground">—</span> : <Badge variant={ok ? "default" : "secondary"}>{label ?? (ok ? "yes" : "no")}</Badge>;
  return (
    <Card className="overflow-x-auto">
      <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">Parallel run — existing renewal reminder vs automation engine</div>
          <div className="text-xs text-muted-foreground">
            Read-only comparison of today's reminder windows. The engine workflow must stay in dry-run unless you are deliberately testing live sends.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input className="h-8 rounded-md border bg-background px-2 text-xs" placeholder="Policy no. prefix (e.g. TEST-)" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>Refresh</Button>
        </div>
      </div>
      {d && (
        <div className="px-4 py-3 border-b grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><div className="text-muted-foreground">Policies in window</div><div className="text-lg font-semibold">{d.summary.policies}</div></div>
          <div><div className="text-muted-foreground">Existing selects / Engine selects</div><div className="text-lg font-semibold">{d.summary.legacy_selected} / {d.summary.engine_selected}</div></div>
          <div><div className="text-muted-foreground">Agreement</div><div className="text-lg font-semibold">{d.summary.agreement}%</div></div>
          <div><div className="text-muted-foreground">Duplicates / failures (existing · engine)</div><div className="text-lg font-semibold">{d.summary.legacy_duplicates}·{d.summary.engine_duplicates} / {d.summary.legacy_failures}·{d.summary.engine_failures}</div></div>
          <div className="col-span-2 md:col-span-4 text-muted-foreground">
            Existing reminder date (UTC): <span className="font-mono">{d.dates.legacy_utc_today}</span> · Engine date (Nairobi): <span className="font-mono">{d.dates.engine_nairobi_today}</span> ·
            Engine workflows: {d.workflows.length === 0 ? "none" : d.workflows.map((w: any) => `${w.name} [${w.status}${w.dry_run ? ", dry-run" : ", LIVE"}]`).join(", ")}
          </div>
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="border-b bg-muted/40 text-left">
          <tr>
            <th className="px-4 py-2">Policy / client</th>
            <th className="px-4 py-2">Expires</th>
            <th className="px-4 py-2">Existing: selected</th>
            <th className="px-4 py-2">Existing: result</th>
            <th className="px-4 py-2">Engine: selected</th>
            <th className="px-4 py-2">Engine: result</th>
            <th className="px-4 py-2">Dupes / fails</th>
          </tr>
        </thead>
        <tbody>
          {d?.rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No policies fall in a reminder window today.</td></tr>}
          {d?.rows.map((r: any) => (
            <tr key={r.policy_id} className={`border-b last:border-0 align-top ${r.legacy.selected !== r.engine.selected ? "bg-destructive/5" : ""}`}>
              <td className="px-4 py-2"><div className="font-mono">{r.policy_no}</div><div className="text-muted-foreground">{r.client_name} · {r.client_email ?? "no email"}{r.client_phone ? ` · ${r.client_phone}` : ""}</div></td>
              <td className="px-4 py-2 whitespace-nowrap">{r.end_date}</td>
              <td className="px-4 py-2">{mark(r.legacy.selected, r.legacy.selected ? `${r.legacy.window_days}d` : undefined)}{r.legacy.reason && <div className="text-muted-foreground">{r.legacy.reason}</div>}</td>
              <td className="px-4 py-2">
                {r.legacy.notifications > 0 ? <>{r.legacy.notifications} notif · email {r.legacy.email_status ?? "n/a"}{r.legacy.sent_at && <div className="text-muted-foreground">{format(new Date(r.legacy.sent_at), "PP p")}</div>}</> : <span className="text-muted-foreground">not run yet</span>}
                {r.legacy.content && <div className="text-muted-foreground italic truncate max-w-[16rem]" title={r.legacy.content}>{r.legacy.content}</div>}
              </td>
              <td className="px-4 py-2">{mark(r.engine.selected, r.engine.selected ? `${r.engine.window_days}d` : undefined)}{r.engine.reason && <div className="text-muted-foreground">{r.engine.reason}</div>}</td>
              <td className="px-4 py-2">
                {!r.engine.event_at && <span className="text-muted-foreground">no event yet</span>}
                {r.engine.event_at && <div>event {format(new Date(r.engine.event_at), "PP p")}</div>}
                {r.engine.runs.map((run: any) => <div key={run.id}>{run.workflow}: <Badge variant={statusVariant(run.status)}>{run.status}</Badge></div>)}
                {r.engine.step_status && <div className="text-muted-foreground">{r.engine.dry_run ? "DRY-RUN would send to" : "email"} {r.engine.would_send_to ?? "—"}{r.engine.message_id ? ` · sent` : ""}</div>}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">{r.legacy.duplicates + r.engine.duplicates} / {r.legacy.failures + r.engine.failures}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function RunSteps({ id }: { id: string }) {
  const get = useServerFn(getWorkflowRun);
  const q = useQuery({ queryKey: ["automation", "run", id], queryFn: () => get({ data: { id } }) });
  if (!q.data) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="border-t bg-muted/20 p-4 space-y-2">
      <div className="text-xs text-muted-foreground">Run {id}</div>
      <table className="w-full text-xs">
        <thead className="text-left"><tr><th className="py-1 pr-3">Node</th><th className="py-1 pr-3">Type</th><th className="py-1 pr-3">Attempt</th><th className="py-1 pr-3">Status</th><th className="py-1 pr-3">Output / error</th><th className="py-1">Finished</th></tr></thead>
        <tbody>
          {q.data.steps.map((s: any) => (
            <tr key={s.id} className="border-t">
              <td className="py-1 pr-3 font-mono">{s.node_id}</td>
              <td className="py-1 pr-3">{s.node_type}</td>
              <td className="py-1 pr-3">{s.attempt}</td>
              <td className="py-1 pr-3"><Badge variant={statusVariant(s.status)}>{s.status}</Badge></td>
              <td className="py-1 pr-3 font-mono break-all">{s.error ?? JSON.stringify(s.output)}</td>
              <td className="py-1">{s.finished_at ? format(new Date(s.finished_at), "p") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
