-- Stores the login identifier used for managed accounts such as guards.
-- Service Role creates the auth user; the frontend only reads these safe labels.

alter table public.profiles
add column if not exists access_email text,
add column if not exists uses_internal_email boolean not null default false;

create index if not exists profiles_access_email_idx
on public.profiles (access_email);
