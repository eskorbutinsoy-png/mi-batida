-- Enable row-level security and create policies for batida_alertas
ALTER TABLE public.batida_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "batida_alertas_select" ON public.batida_alertas;
CREATE POLICY "batida_alertas_select" ON public.batida_alertas FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.batidas b
      WHERE b.id = batida_id
        AND (
          b.creador_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.batida_admins ba
            WHERE ba.batida_id = b.id AND ba.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.batida_miembros bm
            WHERE bm.batida_id = b.id AND bm.user_id = auth.uid() AND bm.estado = 'activo'
          )
        )
    )
  );

DROP POLICY IF EXISTS "batida_alertas_insert" ON public.batida_alertas;
CREATE POLICY "batida_alertas_insert" ON public.batida_alertas FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.batidas b
      WHERE b.id = batida_id
        AND (
          b.creador_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.batida_admins ba
            WHERE ba.batida_id = b.id AND ba.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.batida_miembros bm
            WHERE bm.batida_id = b.id AND bm.user_id = auth.uid() AND bm.estado = 'activo'
          )
        )
    )
  );

DROP POLICY IF EXISTS "batida_alertas_update" ON public.batida_alertas;
CREATE POLICY "batida_alertas_update" ON public.batida_alertas FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "batida_alertas_delete" ON public.batida_alertas;
CREATE POLICY "batida_alertas_delete" ON public.batida_alertas FOR DELETE TO authenticated
  USING (user_id = auth.uid());
