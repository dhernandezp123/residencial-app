-- Hardens UPDATE policies for visits, qr_tokens, and visitor_entries.
-- Residents can only cancel their own active visits/tokens.
-- Guards can mark visits/tokens as used and register exit_time on their own entries.
-- Admins can update anything within their residential.
-- DELETE remains restricted to super_admin; operational flows use soft-state transitions.

-- ============================================================
-- visits — UPDATE
-- ============================================================

drop policy if exists "resident_cancel_own_visit" on public.visits;
drop policy if exists "guard_update_visits_by_residential" on public.visits;
drop policy if exists "admin_update_visits_by_residential" on public.visits;

-- Resident: can only set status = 'cancelled' on their own active visits.
create policy "resident_cancel_own_visit"
on public.visits for update
using (
  created_by = public.current_profile_id()
  and public.is_resident_for_house(house_id)
  and status = 'active'
)
with check (
  created_by = public.current_profile_id()
  and status = 'cancelled'
);

-- Guard: can mark visits as 'used' within their residential (single_use entry flow).
create policy "guard_update_visits_by_residential"
on public.visits for update
using (
  public.is_guard_for_residential(residential_id)
  and status = 'active'
)
with check (
  public.is_guard_for_residential(residential_id)
  and status = 'used'
);

-- Admin: full update within their residential.
create policy "admin_update_visits_by_residential"
on public.visits for update
using (public.is_residential_admin(residential_id))
with check (public.is_residential_admin(residential_id));

-- ============================================================
-- qr_tokens — UPDATE
-- ============================================================

drop policy if exists "resident_cancel_own_qr_token" on public.qr_tokens;
drop policy if exists "guard_update_qr_tokens_by_residential" on public.qr_tokens;
drop policy if exists "admin_update_qr_tokens_by_residential" on public.qr_tokens;

-- Resident: can only cancel active tokens on their own visits.
create policy "resident_cancel_own_qr_token"
on public.qr_tokens for update
using (
  status = 'active'
  and exists (
    select 1 from public.visits v
    where v.id = qr_tokens.visit_id
      and v.created_by = public.current_profile_id()
      and public.is_resident_for_house(v.house_id)
  )
)
with check (
  status = 'cancelled'
);

-- Guard: can mark tokens as 'used' or 'expired' within their residential.
create policy "guard_update_qr_tokens_by_residential"
on public.qr_tokens for update
using (
  public.is_guard_for_residential(residential_id)
  and status = 'active'
)
with check (
  public.is_guard_for_residential(residential_id)
  and status in ('used', 'expired')
);

-- Admin: full update within their residential.
create policy "admin_update_qr_tokens_by_residential"
on public.qr_tokens for update
using (public.is_residential_admin(residential_id))
with check (public.is_residential_admin(residential_id));

-- ============================================================
-- visitor_entries — UPDATE
-- ============================================================

drop policy if exists "guard_update_own_visitor_entries" on public.visitor_entries;
drop policy if exists "admin_update_visitor_entries_by_residential" on public.visitor_entries;

-- Guard: can only set exit_time on entries they created that have no exit yet.
-- entry_status, guard_id, and residential_id must remain unchanged.
create policy "guard_update_own_visitor_entries"
on public.visitor_entries for update
using (
  guard_id = public.current_profile_id()
  and public.is_guard_for_residential(residential_id)
  and exit_time is null
)
with check (
  guard_id = public.current_profile_id()
  and public.is_guard_for_residential(residential_id)
  and exit_time is not null
  and entry_status = 'allowed'
);

-- Admin: full update within their residential.
create policy "admin_update_visitor_entries_by_residential"
on public.visitor_entries for update
using (public.is_residential_admin(residential_id))
with check (public.is_residential_admin(residential_id));

-- ============================================================
-- DELETE hardening note
-- ============================================================
-- DELETE on visits, qr_tokens, visitor_entries, and visitor_photos
-- is intentionally allowed only for super_admin (set in the initial migration).
-- Residents, guards, and admins must never delete operational records.
-- Use soft-state transitions instead:
--   visits / qr_tokens : active → cancelled | used | expired
--   visitor_entries    : immutable after insert; exit registered via exit_time
