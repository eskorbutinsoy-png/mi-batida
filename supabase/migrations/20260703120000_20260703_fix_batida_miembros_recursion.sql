-- Fix infinite recursion in batida_miembros RLS policy
-- The issue: Policy tried to check if user is batida member by querying batida_miembros itself
-- Solution: Use SECURITY DEFINER function to check membership without triggering RLS

-- Drop existing problematic policies
DROP POLICY IF EXISTS "batida_miembros_select" ON public.batida_miembros;
DROP POLICY IF EXISTS "batida_miembros_insert" ON public.batida_miembros;
DROP POLICY IF EXISTS "batida_miembros_update" ON public.batida_miembros;
DROP POLICY IF EXISTS "batida_miembros_delete" ON public.batida_miembros;

-- Drop and recreate helper functions with SECURITY DEFINER to bypass RLS
DROP FUNCTION IF EXISTS public.is_batida_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_batida_member(uuid) CASCADE;

-- Function to check if user is admin of a batida (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_batida_admin(p_batida_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.batida_miembros bm
    WHERE bm.batida_id = p_batida_id
    AND bm.user_id = auth.uid()
    AND bm.tipo = 'perrero'
    AND bm.estado = 'activo'
  ) INTO v_is_admin;
  RETURN v_is_admin;
END;
$$;

-- Function to check if user is a member of a batida (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_batida_member(p_batida_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_member boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.batida_miembros bm
    WHERE bm.batida_id = p_batida_id
    AND bm.user_id = auth.uid()
  ) INTO v_is_member;
  RETURN v_is_member;
END;
$$;

-- New non-recursive policies using SECURITY DEFINER functions
CREATE POLICY "batida_miembros_select"
ON public.batida_miembros
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()  -- Can see own membership
    OR public.is_batida_admin(batida_id)  -- Admins can see all members
    OR public.is_batida_member(batida_id)  -- Any member can see other members
  )
);

CREATE POLICY "batida_miembros_insert"
ON public.batida_miembros
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()  -- User creating their own membership
    OR public.is_batida_admin(batida_id)  -- Admin adding members
  )
);

CREATE POLICY "batida_miembros_update"
ON public.batida_miembros
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()  -- User updating own membership
    OR public.is_batida_admin(batida_id)  -- Admin updating members
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()
    OR public.is_batida_admin(batida_id)
  )
);

CREATE POLICY "batida_miembros_delete"
ON public.batida_miembros
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()  -- User deleting own membership
    OR public.is_batida_admin(batida_id)  -- Admin deleting members
  )
);
