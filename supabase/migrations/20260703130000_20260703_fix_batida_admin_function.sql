-- Fix is_batida_admin function to read from batida_admins instead of batida_miembros
-- This prevents conflicts during INSERT operations on batida_miembros

DROP FUNCTION IF EXISTS public.is_batida_admin(uuid) CASCADE;

-- Recreate function that checks batida_admins table directly
CREATE OR REPLACE FUNCTION public.is_batida_admin(p_batida_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.batida_admins ba
    WHERE ba.batida_id = p_batida_id
    AND ba.user_id = auth.uid()
  );
END;
$$;

-- Recreate RLS policies with fixed function
DROP POLICY IF EXISTS "batida_miembros_select" ON public.batida_miembros;
DROP POLICY IF EXISTS "batida_miembros_insert" ON public.batida_miembros;
DROP POLICY IF EXISTS "batida_miembros_update" ON public.batida_miembros;
DROP POLICY IF EXISTS "batida_miembros_delete" ON public.batida_miembros;

CREATE POLICY "batida_miembros_select"
ON public.batida_miembros
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()
    OR public.is_batida_admin(batida_id)
    OR public.is_batida_member(batida_id)
  )
);

CREATE POLICY "batida_miembros_insert"
ON public.batida_miembros
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()
    OR public.is_batida_admin(batida_id)
  )
);

CREATE POLICY "batida_miembros_update"
ON public.batida_miembros
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()
    OR public.is_batida_admin(batida_id)
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
    user_id = auth.uid()
    OR public.is_batida_admin(batida_id)
  )
);
