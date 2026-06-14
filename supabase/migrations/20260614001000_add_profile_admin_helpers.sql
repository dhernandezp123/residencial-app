create or replace function public.approved_residents_count(target_house_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.profiles
  where house_id = target_house_id
    and role = 'resident'
    and status = 'approved';
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
      and p.role in ('super_admin', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'approved'
      and p.role in ('super_admin', 'admin')
  )
);
