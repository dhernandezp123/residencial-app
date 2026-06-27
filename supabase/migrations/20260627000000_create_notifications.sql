-- Creates public.notifications for in-app notifications.
-- Informs residents, admins, and guards of visitor events and system alerts.

create table if not exists public.notifications (
  id                   uuid        primary key default gen_random_uuid(),
  residential_id       uuid        references public.residentials(id) on delete cascade,
  house_id             uuid        references public.houses(id) on delete cascade,
  recipient_profile_id uuid        not null references public.profiles(id) on delete cascade,
  actor_profile_id     uuid        references public.profiles(id),
  visit_id             uuid        references public.visits(id) on delete set null,
  visitor_entry_id     uuid        references public.visitor_entries(id) on delete set null,
  type                 text        not null,
  title                text        not null,
  message              text        not null,
  read_at              timestamptz,
  created_at           timestamptz not null default now(),

  constraint notifications_type_check
    check (type in ('visitor_entered', 'visitor_exited', 'visit_expiring', 'system'))
);

create index if not exists notifications_recipient_profile_id_idx
  on public.notifications (recipient_profile_id);

create index if not exists notifications_residential_id_idx
  on public.notifications (residential_id);

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

-- Partial index to query unread notifications efficiently
create index if not exists notifications_unread_idx
  on public.notifications (recipient_profile_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "recipient_select_own_notifications"           on public.notifications;
drop policy if exists "recipient_update_own_notifications_read_at"  on public.notifications;
drop policy if exists "super_admin_select_notifications"            on public.notifications;
drop policy if exists "admin_select_notifications_by_residential"   on public.notifications;
drop policy if exists "super_admin_insert_notifications"            on public.notifications;
drop policy if exists "admin_insert_notifications_by_residential"   on public.notifications;
drop policy if exists "guard_insert_notifications_by_residential"   on public.notifications;

-- 1. Recipient can select their own notifications
create policy "recipient_select_own_notifications"
on public.notifications for select
using (
  recipient_profile_id = public.current_profile_id()
);

-- 2. Recipient can mark their own notifications as read (update read_at)
create policy "recipient_update_own_notifications_read_at"
on public.notifications for update
using (
  recipient_profile_id = public.current_profile_id()
)
with check (
  recipient_profile_id = public.current_profile_id()
);

-- 3. Super admin can select all notifications
create policy "super_admin_select_notifications"
on public.notifications for select
using (public.is_super_admin());

-- 4. Admin can select notifications within their residential
create policy "admin_select_notifications_by_residential"
on public.notifications for select
using (public.is_residential_admin(residential_id));

-- 5a. Super admin can insert any notification
create policy "super_admin_insert_notifications"
on public.notifications for insert
with check (public.is_super_admin());

-- 5b. Admin can insert notifications for their residential
create policy "admin_insert_notifications_by_residential"
on public.notifications for insert
with check (
  public.is_residential_admin(residential_id)
);

-- 5c. Guard can insert notifications for their residential
create policy "guard_insert_notifications_by_residential"
on public.notifications for insert
with check (
  public.is_guard_for_residential(residential_id)
);

grant select, insert, update on public.notifications to authenticated;
