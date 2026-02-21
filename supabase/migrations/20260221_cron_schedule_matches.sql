-- Schedule notify-schedule-matches Edge Function every 5 minutes via pg_cron + pg_net
-- Run this once in the Supabase SQL Editor if not already scheduled.

SELECT cron.schedule(
  'notify-schedule-matches',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url    := 'https://ibirrcmamficofgdsnvt.supabase.co/functions/v1/notify-schedule-matches',
      headers := json_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaXJyY21hbWZpY29mZ2RzbnZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxOTU4NiwiZXhwIjoyMDg2NTk1NTg2fQ.hiF0Mkn4yCv2dd03i-JYrwym7KI4NYHvPVK8Lkxu1W8'
      )::jsonb,
      body   := '{}'::jsonb
    ) FROM extensions.pg_net;
  $$
);
