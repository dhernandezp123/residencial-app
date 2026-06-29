do $$
begin
  create type public.incident_report_category as enum (
    'complaint',
    'suggestion',
    'incident'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.incident_report_status as enum (
    'open',
    'reviewing',
    'resolved',
    'dismissed'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  residential_id uuid not null references public.residentials(id) on delete cascade,
  house_id uuid references public.houses(id) on delete set null,
  reporter_profile_id uuid references public.profiles(id) on delete set null,
  guard_profile_id uuid references public.profiles(id) on delete set null,
  category public.incident_report_category not null default 'complaint',
  title text not null,
  description text not null,
  is_anonymous boolean not null default false,
  status public.incident_report_status not null default 'open',
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incident_reports_title_not_blank check (length(trim(title)) > 0),
  constraint incident_reports_description_not_blank check (length(trim(description)) > 0)
);

drop trigger if exists set_incident_reports_updated_at on public.incident_reports;
create trigger set_incident_reports_updated_at
before update on public.incident_reports
for each row
execute function public.set_updated_at();

create index if not exists incident_reports_residential_id_idx
  on public.incident_reports (residential_id);
create index if not exists incident_reports_house_id_idx
  on public.incident_reports (house_id);
create index if not exists incident_reports_reporter_profile_id_idx
  on public.incident_reports (reporter_profile_id);
create index if not exists incident_reports_guard_profile_id_idx
  on public.incident_reports (guard_profile_id);
create index if not exists incident_reports_status_idx
  on public.incident_reports (status);
create index if not exists incident_reports_created_at_idx
  on public.incident_reports (created_at desc);

alter table public.incident_reports enable row level security;

drop policy if exists "super_admin_select_incident_reports" on public.incident_reports;
drop policy if exists "super_admin_update_incident_reports" on public.incident_reports;
drop policy if exists "admin_select_incident_reports_by_residential" on public.incident_reports;
drop policy if exists "admin_update_incident_reports_by_residential" on public.incident_reports;
drop policy if exists "resident_select_own_incident_reports" on public.incident_reports;
drop policy if exists "resident_insert_own_incident_reports" on public.incident_reports;

create policy "super_admin_select_incident_reports"
on public.incident_reports for select
using (public.is_super_admin());

create policy "super_admin_update_incident_reports"
on public.incident_reports for update
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "admin_select_incident_reports_by_residential"
on public.incident_reports for select
using (public.is_residential_admin(residential_id));

create policy "admin_update_incident_reports_by_residential"
on public.incident_reports for update
using (public.is_residential_admin(residential_id))
with check (public.is_residential_admin(residential_id));

create policy "resident_select_own_incident_reports"
on public.incident_reports for select
using (
  reporter_profile_id = public.current_profile_id()
  and house_id is not null
  and public.is_resident_for_house(house_id)
);

create policy "resident_insert_own_incident_reports"
on public.incident_reports for insert
with check (
  residential_id = public.current_residential_id()
  and public.current_role() = 'resident'
  and (
    (
      is_anonymous = true
      and reporter_profile_id is null
      and house_id is null
    )
    or (
      is_anonymous = false
      and reporter_profile_id = public.current_profile_id()
      and house_id is not null
      and public.is_resident_for_house(house_id)
      and exists (
        select 1
        from public.houses h
        where h.id = incident_reports.house_id
          and h.residential_id = incident_reports.residential_id
      )
    )
  )
  and (
    guard_profile_id is null
    or exists (
      select 1
      from public.profiles g
      where g.id = incident_reports.guard_profile_id
        and g.role = 'guard'
        and g.status = 'approved'
        and g.residential_id = incident_reports.residential_id
    )
  )
);

revoke all on public.incident_reports from authenticated;
grant select, insert on public.incident_reports to authenticated;
grant update (status, admin_notes, resolved_at) on public.incident_reports to authenticated;
