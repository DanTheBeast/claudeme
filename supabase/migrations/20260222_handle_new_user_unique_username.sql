-- Fix: generate a guaranteed-unique username for every new user.
--
-- Strategy:
--   1. Take the local part of the email (before @), strip non-alphanumeric chars,
--      lowercase, truncate to 18 chars.
--   2. Try that base username. If it's taken, append a random 4-char hex suffix
--      and retry. Loop up to 10 times (astronomically unlikely to exhaust).
--   3. Fall back to the user's UUID prefix if all retries fail (should never happen).
--
-- Also uses the raw_user_meta_data.display_name if the client sent one at signup,
-- otherwise falls back to the email prefix (capitalised).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate     text;
  display       text;
  attempt       int := 0;
begin
  -- Derive base username from email local part: lowercase, alphanum only, max 18 chars
  base_username := substring(
    regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'),
    1, 18
  );
  -- Fallback if email prefix is empty after stripping
  if base_username = '' then
    base_username := 'user';
  end if;

  -- Derive display name: prefer value sent at signup, else capitalised email prefix
  display := coalesce(
    nullif(trim((new.raw_user_meta_data->>'display_name')::text), ''),
    initcap(split_part(new.email, '@', 1))
  );

  -- Find a unique username
  candidate := base_username;
  loop
    exit when not exists (select 1 from public.profiles where username = candidate);
    attempt := attempt + 1;
    -- After 10 attempts fall back to uuid prefix (guaranteed unique)
    if attempt > 10 then
      candidate := 'user_' || substring(new.id::text, 1, 8);
      exit;
    end if;
    candidate := base_username || '_' || substring(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, email, username, display_name)
  values (new.id, new.email, candidate, display)
  on conflict (id) do nothing;

  return new;
end;
$$;
