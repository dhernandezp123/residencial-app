-- Harden house management and active-house checks.
-- Houses are soft-disabled with is_active=false so operational history remains auditable.

drop policy if exists "super_admin_insert_houses" on public.houses;
drop policy if exists "super_admin_update_houses" on public.houses;
drop policy if exists "admin_insert_houses_by_residential" on public.houses;
drop policy if exists "admin_update_houses_by_residential" on public.houses;

create policy "super_admin_insert_houses"
on public.houses for insert
with check (public.is_super_admin());

create policy "super_admin_update_houses"
on public.houses for update
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "admin_insert_houses_by_residential"
on public.houses for insert
with check (public.is_residential_admin(residential_id));

create policy "admin_update_houses_by_residential"
on public.houses for update
using (public.is_residential_admin(residential_id))
with check (public.is_residential_admin(residential_id));

drop policy if exists "resident_select_own_house_visits" on public.visits;
drop policy if exists "resident_insert_own_house_visits" on public.visits;

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
      and h.is_active = true
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
      and h.is_active = true
      and h.pays_security = true
  )
);
