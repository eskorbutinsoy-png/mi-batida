-- Permite que miembros activos de la batida tambien puedan crear puestos en el mapa.
-- Antes solo los administradores podian insertar, lo que provocaba fallos silenciosos
-- en clientes que mostraban el formulario a cualquier miembro.

DROP POLICY IF EXISTS "puestos_insert" ON public.batida_puestos_mapa;

CREATE POLICY "puestos_insert"
ON public.batida_puestos_mapa
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_batida_admin(batida_id)
  OR EXISTS (
    SELECT 1
    FROM public.batida_miembros bm
    WHERE bm.batida_id = public.batida_puestos_mapa.batida_id
      AND bm.user_id = auth.uid()
      AND bm.estado = 'activo'
  )
);
