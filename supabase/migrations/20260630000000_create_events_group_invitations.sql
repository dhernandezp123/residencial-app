create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  residential_id uuid not null references public.residentials(id) on delete cascade,
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  event_date timestamptz not null,
  valid_until timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  status text not null default 'pending',
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.event_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  residential_id uuid not null references public.residentials(id) on delete cascade,
  token text not null unique,
  status text not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

create index if not exists events_residential_id_idx
  on public.events (residential_id);
create index if not exists events_house_id_idx
  on public.events (house_id);
create index if not exists events_created_by_idx
  on public.events (created_by);
create index if not exists events_status_idx
  on public.events (status);
create index if not exists events_event_date_idx
  on public.events (event_date);

create index if not exists event_guests_event_id_idx
  on public.event_guests (event_id);
create index if not exists event_guests_status_idx
  on public.event_guests (status);

create index if not exists event_qr_tokens_event_id_idx
  on public.event_qr_tokens (event_id);
create index if not exists event_qr_tokens_residential_id_idx
  on public.event_qr_tokens (residential_id);
create index if not exists event_qr_tokens_token_idx
  on public.event_qr_tokens (token);
create index if not exists event_qr_tokens_status_idx
  on public.event_qr_tokens (status);

alter table public.events enable row level security;
alter table public.event_guests enable row level security;
alter table public.event_qr_tokens enable row level security;

drop policy if exists "super_admin_select_events" on public.events;
drop policy if exists "resident_select_own_events" on public.events;
drop policy if exists "resident_insert_own_events" on public.events;
drop policy if exists "resident_update_own_events" on public.events;
drop policy if exists "guard_select_events_by_residential" on public.events;
drop policy if exists "admin_select_events_by_residential" on public.events;

create policy "super_admin_select_events"
on public.events for select
using (public.is_super_admin());

create policy "resident_select_own_events"
on public.events for select
using (created_by = public.current_profile_id());

create policy "resident_insert_own_events"
on public.events for insert
with check (
  created_by = public.current_profile_id()
  and public.is_resident_for_house(house_id)
  and residential_id = public.current_residential_id()
);

create policy "resident_update_own_events"
on public.events for update
using (created_by = public.current_profile_id())
with check (created_by = public.current_profile_id());

create policy "guard_select_events_by_residential"
on public.events for select
using (public.is_guard_for_residential(residential_id));

create policy "admin_select_events_by_residential"
on public.events for select
using (public.is_residential_admin(residential_id));

drop policy if exists "super_admin_select_event_guests" on public.event_guests;
drop policy if exists "resident_select_own_event_guests" on public.event_guests;
drop policy if exists "resident_insert_own_event_guests" on public.event_guests;
drop policy if exists "resident_update_own_event_guests" on public.event_guests;
drop policy if exists "guard_select_event_guests_by_residential" on public.event_guests;
drop policy if exists "guard_update_event_guests_by_residential" on public.event_guests;
drop policy if exists "admin_select_event_guests_by_residential" on public.event_guests;
drop policy if exists "admin_update_event_guests_by_residential" on public.event_guests;

create policy "super_admin_select_event_guests"
on public.event_guests for select
using (public.is_super_admin());

create policy "resident_select_own_event_guests"
on public.event_guests for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and e.created_by = public.current_profile_id()
  )
);

create policy "resident_insert_own_event_guests"
on public.event_guests for insert
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and e.created_by = public.current_profile_id()
  )
);

create policy "resident_update_own_event_guests"
on public.event_guests for update
using (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and e.created_by = public.current_profile_id()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and e.created_by = public.current_profile_id()
  )
);

create policy "guard_select_event_guests_by_residential"
on public.event_guests for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and public.is_guard_for_residential(e.residential_id)
  )
);

create policy "guard_update_event_guests_by_residential"
on public.event_guests for update
using (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and public.is_guard_for_residential(e.residential_id)
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and public.is_guard_for_residential(e.residential_id)
  )
);

create policy "admin_select_event_guests_by_residential"
on public.event_guests for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and public.is_residential_admin(e.residential_id)
  )
);

create policy "admin_update_event_guests_by_residential"
on public.event_guests for update
using (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and public.is_residential_admin(e.residential_id)
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and public.is_residential_admin(e.residential_id)
  )
);

drop policy if exists "super_admin_select_event_qr_tokens" on public.event_qr_tokens;
drop policy if exists "resident_select_own_event_qr_tokens" on public.event_qr_tokens;
drop policy if exists "resident_insert_own_event_qr_tokens" on public.event_qr_tokens;
drop policy if exists "guard_select_event_qr_tokens_by_residential" on public.event_qr_tokens;
drop policy if exists "admin_select_event_qr_tokens_by_residential" on public.event_qr_tokens;

create policy "super_admin_select_event_qr_tokens"
on public.event_qr_tokens for select
using (public.is_super_admin());

create policy "resident_select_own_event_qr_tokens"
on public.event_qr_tokens for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_qr_tokens.event_id
      and e.residential_id = event_qr_tokens.residential_id
      and e.created_by = public.current_profile_id()
  )
);

create policy "resident_insert_own_event_qr_tokens"
on public.event_qr_tokens for insert
with check (
  residential_id = public.current_residential_id()
  and exists (
    select 1
    from public.events e
    where e.id = event_qr_tokens.event_id
      and e.residential_id = event_qr_tokens.residential_id
      and e.created_by = public.current_profile_id()
      and e.status = 'active'
  )
);

create policy "guard_select_event_qr_tokens_by_residential"
on public.event_qr_tokens for select
using (public.is_guard_for_residential(residential_id));

create policy "admin_select_event_qr_tokens_by_residential"
on public.event_qr_tokens for select
using (public.is_residential_admin(residential_id));

grant select, insert, update on public.events to authenticated;
grant select, insert, update on public.event_guests to authenticated;
grant select, insert on public.event_qr_tokens to authenticated;
