-- Permite que usuarios no autenticados (anon) lean residenciales activos.
-- Necesario para que /register pueda validar el residential_id del link de invitación.
-- El riesgo de enumeración es mínimo: los IDs son UUIDs no predecibles.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'residentials'
      AND policyname = 'residentials_anon_select_active'
  ) THEN
    CREATE POLICY "residentials_anon_select_active"
      ON public.residentials FOR SELECT TO anon
      USING (is_active = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'houses'
      AND policyname = 'houses_anon_select_active'
  ) THEN
    CREATE POLICY "houses_anon_select_active"
      ON public.houses FOR SELECT TO anon
      USING (is_active = true);
  END IF;
END $$;
