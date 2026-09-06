-- lovable-cron-fallback-reviewed: 1440 runs/day; automation engine tick explicitly required every minute for delay/retry timing (bounded batches, cheap no-op when idle)
SELECT cron.schedule(
  'automation-tick-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--985ee922-e897-4a14-bb28-5665a84f933f.lovable.app/api/public/automation/tick',
    headers := '{"Content-Type": "application/json", "x-automation-secret": "21188c97e516777b0b02435cf8806639f3ce35f240857a5b"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);