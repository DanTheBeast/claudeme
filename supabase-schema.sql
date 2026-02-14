-- =============================================================
-- CallMe Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- Go to: SQL Editor → New Query → paste this → Run
-- =============================================================

-- ─── Profiles table (extends Supabase auth.users) ────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text not null,
  username text unique,
  phone_number text,
  profile_picture text,
  is_available boolean default false,
  current_mood text,
  availability_type text default 'schedule',
  show_online_status boolean default true,
  show_last_seen boolean default true,
  allow_friend_requests boolean default true,
  allow_phone_search boolean default true,
  enable_push_notifications boolean default true,
  enable_email_notifications boolean default true,
  notify_friend_requests boolean default true,
  notify_availability_changes boolean default true,
  notify_call_suggestions boolean default true,
  quiet_hours_start time,
  quiet_hours_end time,
  enable_quiet_hours boolean default false,
  created_at timestamptz default now(),
  last_seen timestamptz default now()
);

-- ─── Friendships table ────────────────────────────────────────
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  friend_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

-- ─── Availability windows table ──────────────────────────────
create table if not exists public.availability_windows (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  description text
);

-- ─── Row Level Security ──────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.availability_windows enable row level security;

-- Profiles: anyone can read, users can update their own
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Friendships: users can see their own friendships
create policy "Users can view their own friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can create friendships"
  on public.friendships for insert
  with check (auth.uid() = user_id);

create policy "Users can update friendships they're part of"
  on public.friendships for update
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can delete their own friendships"
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Availability windows: users manage their own, friends can view
create policy "Users can view availability of friends"
  on public.availability_windows for select using (true);

create policy "Users can manage their own availability"
  on public.availability_windows for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own availability"
  on public.availability_windows for update
  using (auth.uid() = user_id);

create policy "Users can delete their own availability"
  on public.availability_windows for delete
  using (auth.uid() = user_id);

-- ─── Auto-create profile on signup ───────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    lower(split_part(new.email, '@', 1)) || '_' || substr(new.id::text, 1, 4)
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: automatically create a profile when a user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Realtime ────────────────────────────────────────────────
-- Enable realtime on profiles so clients see availability changes live
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.friendships;
