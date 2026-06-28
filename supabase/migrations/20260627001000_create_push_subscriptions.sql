-- Creates public.push_subscriptions to store Web Push endpoint credentials per profile.

create table if not exists public.push_subscriptions (
  id             uuid        primary key default gen_random_uuid(),
  profile_id     uuid        not null references public.profiles(id) on delete cascade,
  residential_id uuid        references public.residentials(id) on delete cascade,
  endpoint       text        not null unique,
  p256dh         text        not null,
  auth           text        not null,
  user_agent     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

create index if not exists push_subscriptions_profile_id_idx
  on public.push_subscriptions (profile_id);

create index if not exists push_subscriptions_residential_id_idx
  on public.push_subscriptions (residential_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "profile_select_own_push_subscriptions"  on public.push_subscriptions;
drop policy if exists "profile_insert_own_push_subscriptions"  on public.push_subscriptions;
drop policy if exists "profile_delete_own_push_subscriptions"  on public.push_subscriptions;
drop policy if exists "super_admin_select_push_subscriptions"  on public.push_subscriptions;
drop policy if exists "admin_select_push_subscriptions_by_residential" on public.push_subscriptions;

-- User can select their own subscriptions
create policy "profile_select_own_push_subscriptions"
on public.push_subscriptions for select
using (
  profile_id = public.current_profile_id()
);

-- User can register their own subscription
create policy "profile_insert_own_push_subscriptions"
on public.push_subscriptions for insert
with check (
  profile_id = public.current_profile_id()
);

-- User can remove their own subscription
create policy "profile_delete_own_push_subscriptions"
on public.push_subscriptions for delete
using (
  profile_id = public.current_profile_id()
);

-- Super admin can see all subscriptions
create policy "super_admin_select_push_subscriptions"
on public.push_subscriptions for select
using (public.is_super_admin());

-- Admin can see subscriptions within their residential
create policy "admin_select_push_subscriptions_by_residential"
on public.push_subscriptions for select
using (public.is_residential_admin(residential_id));

grant select, insert, delete on public.push_subscriptions to authenticated;
