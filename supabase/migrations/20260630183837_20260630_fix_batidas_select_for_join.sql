-- Allow any authenticated user to see active batidas (needed to join by code)
-- Users who are not yet members need to be able to find the batida by its invite code

DROP POLICY IF EXISTS "batidas_select" ON batidas;
CREATE POLICY "batidas_select" ON batidas FOR SELECT TO authenticated
  USING (
    estado = 'activa'
    OR creador_id = auth.uid()
    OR is_batida_admin(id, auth.uid())
    OR is_batida_member(id, auth.uid())
  );
