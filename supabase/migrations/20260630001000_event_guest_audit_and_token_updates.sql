create table if not exists public.event_guest_entries (
  id uuid primary key default gen_random_uuid(),
  residential_id uuid not null references public.residentials(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  event_guest_id uuid not null references public.event_guests(id) on delete cascade,
  guard_id uuid not null references public.profiles(id),
  action text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists event_guest_entries_residential_id_idx
  on public.event_guest_entries (residential_id);
create index if not exists event_guest_entries_event_id_idx
  on public.event_guest_entries (event_id);
create index if not exists event_guest_entries_event_guest_id_idx
  on public.event_guest_entries (event_guest_id);
create index if not exists event_guest_entries_guard_id_idx
  on public.event_guest_entries (guard_id);

alter table public.event_guest_entries enable row level security;

drop policy if exists "super_admin_select_event_guest_entries" on public.event_guest_entries;
drop policy if exists "resident_select_own_event_guest_entries" on public.event_guest_entries;
drop policy if exists "guard_select_event_guest_entries_by_residential" on public.event_guest_entries;
drop policy if exists "guard_insert_event_guest_entries_by_residential" on public.event_guest_entries;
drop policy if exists "admin_select_event_guest_entries_by_residential" on public.event_guest_entries;

create policy "super_admin_select_event_guest_entries"
on public.event_guest_entries for select
using (public.is_super_admin());

create policy "resident_select_own_event_guest_entries"
on public.event_guest_entries for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_guest_entries.event_id
      and e.created_by = public.current_profile_id()
  )
);

create policy "guard_select_event_guest_entries_by_residential"
on public.event_guest_entries for select
using (public.is_guard_for_residential(residential_id));

create policy "guard_insert_event_guest_entries_by_residential"
on public.event_guest_entries for insert
with check (
  guard_id = public.current_profile_id()
  and public.is_guard_for_residential(residential_id)
  and exists (
    select 1
    from public.events e
    where e.id = event_guest_entries.event_id
      and e.residential_id = event_guest_entries.residential_id
  )
  and exists (
    select 1
    from public.event_guests eg
    where eg.id = event_guest_entries.event_guest_id
      and eg.event_id = event_guest_entries.event_id
  )
);

create policy "admin_select_event_guest_entries_by_residential"
on public.event_guest_entries for select
using (public.is_residential_admin(residential_id));

drop policy if exists "resident_update_own_event_qr_tokens" on public.event_qr_tokens;
drop policy if exists "admin_update_event_qr_tokens_by_residential" on public.event_qr_tokens;

create policy "resident_update_own_event_qr_tokens"
on public.event_qr_tokens for update
using (
  exists (
    select 1
    from public.events e
    where e.id = event_qr_tokens.event_id
      and e.residential_id = event_qr_tokens.residential_id
      and e.created_by = public.current_profile_id()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_qr_tokens.event_id
      and e.residential_id = event_qr_tokens.residential_id
      and e.created_by = public.current_profile_id()
  )
);

create policy "admin_update_event_qr_tokens_by_residential"
on public.event_qr_tokens for update
using (public.is_residential_admin(residential_id))
with check (public.is_residential_admin(residential_id));

grant select, insert on public.event_guest_entries to authenticated;
grant update on public.event_qr_tokens to authenticated;
