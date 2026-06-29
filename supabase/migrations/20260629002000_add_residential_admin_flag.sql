alter table public.profiles
add column if not exists is_residential_admin boolean not null default false;

update public.profiles
set is_residential_admin = true
where role = 'admin'
  and status = 'approved';

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
      and p.residential_id = target_residential_id
      and (
        p.role = 'admin'
        or p.is_residential_admin = true
      )
  )
$$;

drop policy if exists "profiles_update_admins" on public.profiles;

create policy "profiles_update_admins"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'approved'
      and (
        p.role in ('super_admin', 'admin')
        or p.is_residential_admin = true
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'approved'
      and (
        p.role in ('super_admin', 'admin')
        or p.is_residential_admin = true
      )
  )
);
