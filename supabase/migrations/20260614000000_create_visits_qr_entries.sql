create extension if not exists pgcrypto;

do $$
begin
  create type public.visit_status as enum (
    'active',
    'used',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.visit_type as enum (
    'family',
    'delivery',
    'service',
    'provider',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.qr_token_status as enum (
    'active',
    'used',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.entry_status as enum (
    'allowed',
    'denied'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.visitor_photo_type as enum (
    'vehicle',
    'plate',
    'identity',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  residential_id uuid not null references public.residentials(id) on delete cascade,
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  visitor_name text not null,
  visitor_identity text,
  vehicle_plate text,
  visit_type public.visit_type not null default 'family',
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  status public.visit_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  residential_id uuid not null references public.residentials(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null,
  status public.qr_token_status not null default 'active',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.qr_tokens.token is
  'Opaque token intended for QR payloads. QR codes must contain this token only, never internal ids or sensitive visitor data.';

create table if not exists public.visitor_entries (
  id uuid primary key default gen_random_uuid(),
  residential_id uuid not null references public.residentials(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null,
  qr_token_id uuid references public.qr_tokens(id) on delete set null,
  house_id uuid not null references public.houses(id) on delete cascade,
  guard_id uuid not null references public.profiles(id),
  entry_status public.entry_status not null default 'allowed',
  denial_reason text,
  entry_time timestamptz not null default now(),
  exit_time timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visitor_photos (
  id uuid primary key default gen_random_uuid(),
  residential_id uuid not null references public.residentials(id) on delete cascade,
  visitor_entry_id uuid not null references public.visitor_entries(id) on delete cascade,
  photo_type public.visitor_photo_type not null,
  photo_url text not null,
  created_at timestamptz not null default now()
);

drop trigger if exists set_visits_updated_at on public.visits;
create trigger set_visits_updated_at
before update on public.visits
for each row
execute function public.set_updated_at();

drop trigger if exists set_visitor_entries_updated_at on public.visitor_entries;
create trigger set_visitor_entries_updated_at
before update on public.visitor_entries
for each row
execute function public.set_updated_at();

create index if not exists visits_residential_id_idx
  on public.visits (residential_id);
create index if not exists visits_house_id_idx
  on public.visits (house_id);
create index if not exists visits_created_by_idx
  on public.visits (created_by);
create index if not exists visits_status_idx
  on public.visits (status);
create index if not exists visits_valid_until_idx
  on public.visits (valid_until);

create index if not exists qr_tokens_token_idx
  on public.qr_tokens (token);
create index if not exists qr_tokens_visit_id_idx
  on public.qr_tokens (visit_id);
create index if not exists qr_tokens_residential_id_idx
  on public.qr_tokens (residential_id);
create index if not exists qr_tokens_status_idx
  on public.qr_tokens (status);
create index if not exists qr_tokens_expires_at_idx
  on public.qr_tokens (expires_at);

create index if not exists visitor_entries_residential_id_idx
  on public.visitor_entries (residential_id);
create index if not exists visitor_entries_house_id_idx
  on public.visitor_entries (house_id);
create index if not exists visitor_entries_guard_id_idx
  on public.visitor_entries (guard_id);
create index if not exists visitor_entries_entry_time_idx
  on public.visitor_entries (entry_time);

create index if not exists visitor_photos_visitor_entry_id_idx
  on public.visitor_photos (visitor_entry_id);

alter table public.visits enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.visitor_entries enable row level security;
alter table public.visitor_photos enable row level security;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.status = 'approved'
  limit 1
$$;

create or replace function public.current_residential_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.residential_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.status = 'approved'
  limit 1
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.user_id = auth.uid()
    and p.status = 'approved'
  limit 1
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'approved'
      and p.role = 'super_admin'
  )
$$;

create or replace function public.is_residential_admin(target_residential_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'approved'
      and p.role = 'admin'
      and p.residential_id = target_residential_id
  )
$$;

create or replace function public.is_guard_for_residential(target_residential_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'approved'
      and p.role = 'guard'
      and p.residential_id = target_residential_id
  )
$$;

create or replace function public.is_resident_for_house(target_house_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'approved'
      and p.role = 'resident'
      and p.house_id = target_house_id
  )
$$;

drop policy if exists "super_admin_select_visits" on public.visits;
drop policy if exists "super_admin_insert_visits" on public.visits;
drop policy if exists "super_admin_update_visits" on public.visits;
drop policy if exists "super_admin_delete_visits" on public.visits;
drop policy if exists "admin_select_visits_by_residential" on public.visits;
drop policy if exists "resident_select_own_house_visits" on public.visits;
drop policy if exists "resident_insert_own_house_visits" on public.visits;
drop policy if exists "guard_select_visits_by_residential" on public.visits;

create policy "super_admin_select_visits"
on public.visits for select
using (public.is_super_admin());

create policy "super_admin_insert_visits"
on public.visits for insert
with check (public.is_super_admin());

create policy "super_admin_update_visits"
on public.visits for update
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "super_admin_delete_visits"
on public.visits for delete
using (public.is_super_admin());

create policy "admin_select_visits_by_residential"
on public.visits for select
using (public.is_residential_admin(residential_id));

create policy "resident_select_own_house_visits"
on public.visits for select
using (
  created_by = public.current_profile_id()
  and public.is_resident_for_house(house_id)
  and exists (
    select 1
    from public.houses h
    where h.id = visits.house_id
      and h.residential_id = visits.residential_id
      and h.pays_security = true
  )
);

create policy "resident_insert_own_house_visits"
on public.visits for insert
with check (
  created_by = public.current_profile_id()
  and public.is_resident_for_house(house_id)
  and exists (
    select 1
    from public.houses h
    where h.id = visits.house_id
      and h.residential_id = visits.residential_id
      and h.pays_security = true
  )
);

create policy "guard_select_visits_by_residential"
on public.visits for select
using (public.is_guard_for_residential(residential_id));

drop policy if exists "super_admin_select_qr_tokens" on public.qr_tokens;
drop policy if exists "super_admin_insert_qr_tokens" on public.qr_tokens;
drop policy if exists "super_admin_update_qr_tokens" on public.qr_tokens;
drop policy if exists "super_admin_delete_qr_tokens" on public.qr_tokens;
drop policy if exists "admin_select_qr_tokens_by_residential" on public.qr_tokens;
drop policy if exists "resident_select_own_visit_qr_tokens" on public.qr_tokens;
drop policy if exists "resident_insert_own_visit_qr_tokens" on public.qr_tokens;
drop policy if exists "guard_select_qr_tokens_by_residential" on public.qr_tokens;

create policy "super_admin_select_qr_tokens"
on public.qr_tokens for select
using (public.is_super_admin());

create policy "super_admin_insert_qr_tokens"
on public.qr_tokens for insert
with check (public.is_super_admin());

create policy "super_admin_update_qr_tokens"
on public.qr_tokens for update
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "super_admin_delete_qr_tokens"
on public.qr_tokens for delete
using (public.is_super_admin());

create policy "admin_select_qr_tokens_by_residential"
on public.qr_tokens for select
using (public.is_residential_admin(residential_id));

create policy "resident_select_own_visit_qr_tokens"
on public.qr_tokens for select
using (
  exists (
    select 1
    from public.visits v
    where v.id = qr_tokens.visit_id
      and v.residential_id = qr_tokens.residential_id
      and v.created_by = public.current_profile_id()
      and public.is_resident_for_house(v.house_id)
  )
);

create policy "resident_insert_own_visit_qr_tokens"
on public.qr_tokens for insert
with check (
  exists (
    select 1
    from public.visits v
    where v.id = qr_tokens.visit_id
      and v.residential_id = qr_tokens.residential_id
      and v.created_by = public.current_profile_id()
      and public.is_resident_for_house(v.house_id)
      and v.status = 'active'
  )
);

create policy "guard_select_qr_tokens_by_residential"
on public.qr_tokens for select
using (public.is_guard_for_residential(residential_id));

drop policy if exists "super_admin_select_visitor_entries" on public.visitor_entries;
drop policy if exists "super_admin_insert_visitor_entries" on public.visitor_entries;
drop policy if exists "super_admin_update_visitor_entries" on public.visitor_entries;
drop policy if exists "super_admin_delete_visitor_entries" on public.visitor_entries;
drop policy if exists "admin_select_visitor_entries_by_residential" on public.visitor_entries;
drop policy if exists "guard_insert_visitor_entries_by_residential" on public.visitor_entries;

create policy "super_admin_select_visitor_entries"
on public.visitor_entries for select
using (public.is_super_admin());

create policy "super_admin_insert_visitor_entries"
on public.visitor_entries for insert
with check (public.is_super_admin());

create policy "super_admin_update_visitor_entries"
on public.visitor_entries for update
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "super_admin_delete_visitor_entries"
on public.visitor_entries for delete
using (public.is_super_admin());

create policy "admin_select_visitor_entries_by_residential"
on public.visitor_entries for select
using (public.is_residential_admin(residential_id));

create policy "guard_insert_visitor_entries_by_residential"
on public.visitor_entries for insert
with check (
  guard_id = public.current_profile_id()
  and public.is_guard_for_residential(residential_id)
  and exists (
    select 1
    from public.houses h
    where h.id = visitor_entries.house_id
      and h.residential_id = visitor_entries.residential_id
  )
  and (
    visit_id is null
    or exists (
      select 1
      from public.visits v
      where v.id = visitor_entries.visit_id
        and v.residential_id = visitor_entries.residential_id
        and v.house_id = visitor_entries.house_id
    )
  )
  and (
    qr_token_id is null
    or exists (
      select 1
      from public.qr_tokens qt
      where qt.id = visitor_entries.qr_token_id
        and qt.residential_id = visitor_entries.residential_id
    )
  )
);

drop policy if exists "super_admin_select_visitor_photos" on public.visitor_photos;
drop policy if exists "super_admin_insert_visitor_photos" on public.visitor_photos;
drop policy if exists "super_admin_update_visitor_photos" on public.visitor_photos;
drop policy if exists "super_admin_delete_visitor_photos" on public.visitor_photos;
drop policy if exists "admin_select_visitor_photos_by_residential" on public.visitor_photos;
drop policy if exists "guard_insert_visitor_photos_by_residential" on public.visitor_photos;

create policy "super_admin_select_visitor_photos"
on public.visitor_photos for select
using (public.is_super_admin());

create policy "super_admin_insert_visitor_photos"
on public.visitor_photos for insert
with check (public.is_super_admin());

create policy "super_admin_update_visitor_photos"
on public.visitor_photos for update
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "super_admin_delete_visitor_photos"
on public.visitor_photos for delete
using (public.is_super_admin());

create policy "admin_select_visitor_photos_by_residential"
on public.visitor_photos for select
using (public.is_residential_admin(residential_id));

create policy "guard_insert_visitor_photos_by_residential"
on public.visitor_photos for insert
with check (
  public.is_guard_for_residential(residential_id)
  and exists (
    select 1
    from public.visitor_entries ve
    where ve.id = visitor_photos.visitor_entry_id
      and ve.residential_id = visitor_photos.residential_id
      and ve.guard_id = public.current_profile_id()
  )
);

-- TODO: Endurecer UPDATE para residentes, guardias y admins segun flujos finales
--       de cancelacion, expiracion, salida de visitante y auditoria.
-- TODO: Endurecer DELETE para evitar borrado operativo; preferir soft states
--       como cancelled, expired, denied o registros de auditoria inmutables.
