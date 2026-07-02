alter table public.visitor_entries
add column if not exists validation_method text not null default 'qr';

alter table public.visitor_entries
drop constraint if exists visitor_entries_validation_method_check;

alter table public.visitor_entries
add constraint visitor_entries_validation_method_check
check (validation_method in ('qr', 'manual_search'));

create index if not exists visitor_entries_validation_method_idx
  on public.visitor_entries (validation_method);
