alter table public.event_guest_entries
  add column if not exists identity_photo_url text,
  add column if not exists vehicle_photo_url text,
  add column if not exists plate_photo_url text;
