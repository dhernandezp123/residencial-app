-- Grant SELECT to service_role on core tables.
-- Required for server-side API routes that use the service role key
-- to bypass RLS (e.g. /api/register/validate-house-capacity).
grant select on table public.houses to service_role;
grant select on table public.profiles to service_role;
grant select on table public.residentials to service_role;
