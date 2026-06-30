-- Grant full access to service_role on all public tables and sequences.
-- Required for server-side API routes that use the service role key
-- to bypass RLS (e.g. register-access, validate-house-capacity).
-- Supabase does not always apply these grants automatically on tables
-- created via SQL; this migration makes them explicit.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
