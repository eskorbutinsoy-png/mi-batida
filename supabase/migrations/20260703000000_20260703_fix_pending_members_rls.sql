-- Fix RLS to allow pending members to read members list
-- The previous policy required estado='activo' which blocked pending members from seeing anything

DROP POLICY IF EXISTS "batida_miembros_select" ON batida_miembros;
CREATE POLICY "batida_miembros_select" ON batida_miembros FOR SELECT TO authenticated
  USING (
    -- User can see their own record
    user_id = auth.uid()
    -- Admin can see all members of their batidas
    OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
    -- Any member (activo or pendiente) can see other members in the same batida
    OR EXISTS (SELECT 1 FROM batida_miembros bm2 WHERE bm2.batida_id = batida_id AND bm2.user_id = auth.uid())
  );
