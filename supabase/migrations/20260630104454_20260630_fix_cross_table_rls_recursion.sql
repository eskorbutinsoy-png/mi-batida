/*
# Fix cross-table RLS recursion (batida_admins <-> batida_miembros)

Problem: circular reference chain
  batida_admins SELECT → batida_miembros → batida_admins SELECT → ...
  batida_miembros SELECT has self-reference via bm2

Fix: create is_batida_member() SECURITY DEFINER (like is_batida_admin) and
rewrite ALL policies that cross-reference these two tables.
*/

-- Helper: check active member without triggering RLS
CREATE OR REPLACE FUNCTION public.is_batida_member(bid uuid, uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.batida_miembros
    WHERE batida_id = bid AND user_id = uid AND estado = 'activo'
  );
$$;

-- ── batida_admins: remove cross-table reference to batida_miembros ────────────

DROP POLICY IF EXISTS "batida_admins_select" ON batida_admins;
CREATE POLICY "batida_admins_select" ON batida_admins FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_batida_member(batida_id, auth.uid())
  );

-- ── batida_miembros: remove self-ref and use SECURITY DEFINER for admin ───────

DROP POLICY IF EXISTS "batida_miembros_select" ON batida_miembros;
CREATE POLICY "batida_miembros_select" ON batida_miembros FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_batida_admin(batida_id, auth.uid())
    OR is_batida_member(batida_id, auth.uid())
  );

DROP POLICY IF EXISTS "batida_miembros_insert" ON batida_miembros;
CREATE POLICY "batida_miembros_insert" ON batida_miembros FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR is_batida_admin(batida_id, auth.uid())
  );

DROP POLICY IF EXISTS "batida_miembros_update" ON batida_miembros;
CREATE POLICY "batida_miembros_update" ON batida_miembros FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_batida_admin(batida_id, auth.uid())
  );

DROP POLICY IF EXISTS "batida_miembros_delete" ON batida_miembros;
CREATE POLICY "batida_miembros_delete" ON batida_miembros FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_batida_admin(batida_id, auth.uid())
  );

-- ── batidas: use both SECURITY DEFINER functions ──────────────────────────────

DROP POLICY IF EXISTS "batidas_select" ON batidas;
CREATE POLICY "batidas_select" ON batidas FOR SELECT TO authenticated
  USING (
    creador_id = auth.uid()
    OR is_batida_admin(id, auth.uid())
    OR is_batida_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "batidas_update" ON batidas;
CREATE POLICY "batidas_update" ON batidas FOR UPDATE TO authenticated
  USING (
    creador_id = auth.uid()
    OR is_batida_admin(id, auth.uid())
  );

-- ── Remaining tables: replace all subqueries with SECURITY DEFINER calls ──────

DROP POLICY IF EXISTS "batida_posiciones_select" ON batida_posiciones;
CREATE POLICY "batida_posiciones_select" ON batida_posiciones FOR SELECT TO authenticated
  USING (is_batida_admin(batida_id, auth.uid()) OR is_batida_member(batida_id, auth.uid()));

DROP POLICY IF EXISTS "batida_posiciones_insert" ON batida_posiciones;
CREATE POLICY "batida_posiciones_insert" ON batida_posiciones FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (is_batida_admin(batida_id, auth.uid()) OR is_batida_member(batida_id, auth.uid()))
  );

DROP POLICY IF EXISTS "batida_registros_select" ON batida_registros;
CREATE POLICY "batida_registros_select" ON batida_registros FOR SELECT TO authenticated
  USING (is_batida_admin(batida_id, auth.uid()) OR is_batida_member(batida_id, auth.uid()));

DROP POLICY IF EXISTS "batida_registros_insert" ON batida_registros;
CREATE POLICY "batida_registros_insert" ON batida_registros FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (is_batida_admin(batida_id, auth.uid()) OR is_batida_member(batida_id, auth.uid()))
  );

DROP POLICY IF EXISTS "batida_registros_update" ON batida_registros;
CREATE POLICY "batida_registros_update" ON batida_registros FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_batida_admin(batida_id, auth.uid()));

DROP POLICY IF EXISTS "batida_registros_delete" ON batida_registros;
CREATE POLICY "batida_registros_delete" ON batida_registros FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_batida_admin(batida_id, auth.uid()));

DROP POLICY IF EXISTS "batida_rastros_select" ON batida_rastros;
CREATE POLICY "batida_rastros_select" ON batida_rastros FOR SELECT TO authenticated
  USING (is_batida_admin(batida_id, auth.uid()) OR is_batida_member(batida_id, auth.uid()));

DROP POLICY IF EXISTS "batida_rastros_insert" ON batida_rastros;
CREATE POLICY "batida_rastros_insert" ON batida_rastros FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (is_batida_admin(batida_id, auth.uid()) OR is_batida_member(batida_id, auth.uid()))
  );

DROP POLICY IF EXISTS "batida_rastros_update" ON batida_rastros;
CREATE POLICY "batida_rastros_update" ON batida_rastros FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_batida_admin(batida_id, auth.uid()));

DROP POLICY IF EXISTS "batida_rastros_delete" ON batida_rastros;
CREATE POLICY "batida_rastros_delete" ON batida_rastros FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_batida_admin(batida_id, auth.uid()));

DROP POLICY IF EXISTS "chat_select" ON batida_chat_mensajes;
CREATE POLICY "chat_select" ON batida_chat_mensajes FOR SELECT TO authenticated
  USING (is_batida_admin(batida_id, auth.uid()) OR is_batida_member(batida_id, auth.uid()));

DROP POLICY IF EXISTS "chat_insert" ON batida_chat_mensajes;
CREATE POLICY "chat_insert" ON batida_chat_mensajes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      is_batida_admin(batida_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM batida_miembros bm
        WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid()
          AND bm.estado = 'activo' AND bm.silenciado = false
      )
    )
  );

DROP POLICY IF EXISTS "chat_delete" ON batida_chat_mensajes;
CREATE POLICY "chat_delete" ON batida_chat_mensajes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_batida_admin(batida_id, auth.uid()));

DROP POLICY IF EXISTS "puestos_select" ON batida_puestos_mapa;
CREATE POLICY "puestos_select" ON batida_puestos_mapa FOR SELECT TO authenticated
  USING (is_batida_admin(batida_id, auth.uid()) OR is_batida_member(batida_id, auth.uid()));

DROP POLICY IF EXISTS "puestos_insert" ON batida_puestos_mapa;
CREATE POLICY "puestos_insert" ON batida_puestos_mapa FOR INSERT TO authenticated
  WITH CHECK (is_batida_admin(batida_id, auth.uid()));

DROP POLICY IF EXISTS "puestos_update" ON batida_puestos_mapa;
CREATE POLICY "puestos_update" ON batida_puestos_mapa FOR UPDATE TO authenticated
  USING (is_batida_admin(batida_id, auth.uid()));

DROP POLICY IF EXISTS "puestos_delete" ON batida_puestos_mapa;
CREATE POLICY "puestos_delete" ON batida_puestos_mapa FOR DELETE TO authenticated
  USING (is_batida_admin(batida_id, auth.uid()));
