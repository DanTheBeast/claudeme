-- Fix: set a fixed search_path on handle_new_user to prevent search_path injection attacks.
-- Without this, a malicious user could potentially create objects in a schema that
-- gets searched before 'public', causing the trigger to execute unintended code.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    lower(split_part(new.email, '@', 1)),
    split_part(new.email, '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
