# Renewal Email and Automation Runbook

Reviewed sources: `src/routes/api/public/hooks/renewal-reminders.ts`, `src/routes/api/public/automation/tick.ts`, and `src/lib/automation/engine.server.ts`.

## Renewal reminder hook
The POST endpoint requires the `x-hook-secret` header matching `RENEWAL_HOOK_SECRET`. It computes business dates in Africa/Nairobi and processes expiry windows of 60, 30, 14, 7 and 1 days. It creates notification records and uses email queueing, unsubscribe-token and suppression data. This does not establish that a scheduler or delivery provider is operational.

## Workflow automation
The automation tick requires `x-automation-secret` matching `AUTOMATION_TICK_SECRET`. The engine declares batches of 25 events and 25 jobs, with a maximum of 50 nodes per invocation. Its implementation includes workflow runs, queued jobs, retries and step-execution records. Actual concurrency and idempotency guarantees require database and runtime tests.

## Operational verification
1. Confirm the scheduled jobs are registered and run at the intended times.
2. Test each reminder window with synthetic policies.
3. Repeat jobs to detect duplicate messages.
4. Test unsubscribed and suppressed recipients.
5. Check retries, failure alerts, template rendering and email sender authentication.
6. Confirm tenant isolation and redact personal information from logs.

Status: implementation inspected; live delivery and scheduler execution unverified.
