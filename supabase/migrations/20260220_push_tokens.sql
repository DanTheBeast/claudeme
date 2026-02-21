-- Push notification device tokens
create table if not exists push_tokens (
  id          bigserial primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  token       text not null,
  platform    text not null default 'ios', -- 'ios' | 'android'
  updated_at  timestamptz not null default now(),
  unique(user_id, token)
);

-- Only the owning user can read/write their tokens
alter table push_tokens enable row level security;

create policy "Users manage own push tokens"
  on push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role (Edge Functions) needs full access
create policy "Service role full access to push_tokens"
  on push_tokens for all
  to service_role
  using (true)
  with check (true);

-- Track which schedule-match notifications have already been sent
-- so we don't spam the same pair every minute the cron fires.
create table if not exists notified_schedule_matches (
  id              bigserial primary key,
  user_id         uuid not null references profiles(id) on delete cascade,
  friend_id       uuid not null references profiles(id) on delete cascade,
  window_date     date not null,   -- the calendar date of the match
  start_time      text not null,   -- "HH:MM"
  notified_at     timestamptz not null default now(),
  unique(user_id, friend_id, window_date, start_time)
);

alter table notified_schedule_matches enable row level security;

create policy "Service role full access to notified_schedule_matches"
  on notified_schedule_matches for all
  to service_role
  using (true)
  with check (true);
