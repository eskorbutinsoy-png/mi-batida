-- Solución simple: actualizar la política RLS de batida_registros
-- Permite que admins creen registros para otros usuarios

DROP POLICY IF EXISTS "batida_registros_insert" ON batida_registros;

CREATE POLICY "batida_registros_insert" ON batida_registros FOR INSERT TO authenticated
  WITH CHECK (
    -- El creador del registro debe ser admin O el mismo usuario
    (
      auth.uid() IN (
        SELECT user_id FROM batida_admins WHERE batida_id = batida_registros.batida_id
      )
      OR user_id = auth.uid()
    )
    -- Y el creador debe ser activo o admin
    AND (
      auth.uid() IN (
        SELECT user_id FROM batida_admins WHERE batida_id = batida_registros.batida_id
      )
      OR EXISTS (
        SELECT 1 FROM batida_miembros
        WHERE batida_id = batida_registros.batida_id
        AND user_id = auth.uid()
        AND estado = 'activo'
      )
    )
  );
