# Automation and renewal reminders

## Confirmed implementation entry points
- `src/routes/api/public/automation/tick.ts` accepts GET and POST, validates `x-automation-secret` against `AUTOMATION_TICK_SECRET`, then calls `runTick(supabaseAdmin)`.
- The source comment describes a scheduler invoked by pg_cron, processing bounded work (up to 25 events and 25 jobs, about a 20-second budget). **The actual scheduler configuration was not verified.**
- `src/routeTree.gen.ts` includes `/api/public/hooks/renewal-reminders`.
- `src/routes/_authenticated/renewals.tsx` lists expiring policies and provides date-range filters.

## Validation priorities
1. Confirm deployed schedule and time zone.
2. Verify event/job leasing and concurrency control.
3. Check deduplication and retry behavior across timeouts.
4. Verify secret rotation and endpoint method restrictions.
5. Test reminder consent, template rendering and suppression.
6. Observe metrics: due jobs, succeeded, retried, failed, dead-lettered.
7. Confirm tenant separation for all scheduled actions.

The existence of the scheduler endpoint is **not** proof that automated reminders are being sent.
