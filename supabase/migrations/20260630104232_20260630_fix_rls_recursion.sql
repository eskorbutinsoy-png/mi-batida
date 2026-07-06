/*
# Fix infinite recursion in RLS policies

## Problem
The policies on `batidas` and `batida_admins` create a circular reference:
- `batidas` SELECT checks `batida_admins` via subquery
- `batida_admins` SELECT checked `batida_admins` itself (self-referential)
This caused infinite recursion when querying batidas.

## Fix
1. Create a SECURITY DEFINER helper function `is_batida_admin()` that queries
   `batida_admins` bypassing RLS — no recursion possible.
2. Replace all self-referential `batida_admins` subqueries with this function.
3. Update `batidas` and `batida_admins` policies to use the function.
*/

-- Helper function: checks admin status bypassing RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_batida_admin(bid uuid, uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.batida_admins WHERE batida_id = bid AND user_id = uid);
$$;

-- ── batida_admins policies (remove all self-referential subqueries) ────────────

DROP POLICY IF EXISTS "batida_admins_select" ON batida_admins;
CREATE POLICY "batida_admins_select" ON batida_admins FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM batida_miembros bm
      WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "batida_admins_insert" ON batida_admins;
CREATE POLICY "batida_admins_insert" ON batida_admins FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM batidas b WHERE b.id = batida_id AND b.creador_id = auth.uid())
    OR is_batida_admin(batida_id, auth.uid())
  );

DROP POLICY IF EXISTS "batida_admins_update" ON batida_admins;
CREATE POLICY "batida_admins_update" ON batida_admins FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM batidas b WHERE b.id = batida_id AND b.creador_id = auth.uid()));

DROP POLICY IF EXISTS "batida_admins_delete" ON batida_admins;
CREATE POLICY "batida_admins_delete" ON batida_admins FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM batidas b WHERE b.id = batida_id AND b.creador_id = auth.uid())
    OR is_batida_admin(batida_id, auth.uid())
  );

-- ── batidas policies (use SECURITY DEFINER function) ─────────────────────────

DROP POLICY IF EXISTS "batidas_select" ON batidas;
CREATE POLICY "batidas_select" ON batidas FOR SELECT TO authenticated
  USING (
    creador_id = auth.uid()
    OR is_batida_admin(id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM batida_miembros bm
      WHERE bm.batida_id = id AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "batidas_update" ON batidas;
CREATE POLICY "batidas_update" ON batidas FOR UPDATE TO authenticated
  USING (
    creador_id = auth.uid()
    OR is_batida_admin(id, auth.uid())
  );
