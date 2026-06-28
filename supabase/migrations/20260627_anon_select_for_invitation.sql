-- Permite que usuarios no autenticados (anon) lean residenciales activos.
-- Necesario para que /register pueda validar el residential_id del link de invitación.
-- El riesgo de enumeración es mínimo: los IDs son UUIDs no predecibles.

CREATE POLICY "residentials_anon_select_active"
  ON public.residentials
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Permite que usuarios no autenticados lean casas activas de un residencial.
-- Necesario para que /register pueda listar casas y validar la del nuevo residente.

CREATE POLICY "houses_anon_select_active"
  ON public.houses
  FOR SELECT
  TO anon
  USING (is_active = true);
