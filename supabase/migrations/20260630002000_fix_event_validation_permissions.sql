drop policy if exists "super_admin_update_event_guests" on public.event_guests;

create policy "super_admin_update_event_guests"
on public.event_guests for update
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "admin_insert_event_guest_entries_by_residential" on public.event_guest_entries;
drop policy if exists "super_admin_insert_event_guest_entries" on public.event_guest_entries;

create policy "admin_insert_event_guest_entries_by_residential"
on public.event_guest_entries for insert
with check (
  guard_id = public.current_profile_id()
  and public.is_residential_admin(residential_id)
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

create policy "super_admin_insert_event_guest_entries"
on public.event_guest_entries for insert
with check (
  guard_id = public.current_profile_id()
  and public.is_super_admin()
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
