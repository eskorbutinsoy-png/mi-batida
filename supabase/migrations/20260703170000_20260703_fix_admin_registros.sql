-- Función RPC para que admins registren cazas para otros usuarios
-- Esta función se ejecuta con SECURITY DEFINER, así que bypasea las RLS policies

DROP FUNCTION IF EXISTS admin_create_registro(uuid, uuid, text, text, text, text);

CREATE FUNCTION admin_create_registro(
  p_batida_id uuid,
  p_target_user_id uuid,
  p_especie text,
  p_tipo_registro text,
  p_raza text DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS batida_registros
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result batida_registros;
BEGIN
  -- Verificar que el usuario actual es admin de la batida
  IF NOT EXISTS (
    SELECT 1 FROM batida_admins
    WHERE batida_id = p_batida_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No eres admin de esta batida';
  END IF;

  -- Crear el registro (bypasea RLS porque es SECURITY DEFINER)
  INSERT INTO batida_registros (batida_id, user_id, especie, tipo_registro, raza, notas)
  VALUES (p_batida_id, p_target_user_id, p_especie, p_tipo_registro, p_raza, p_notas)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Permitir que usuarios autenticados ejecuten esta función
GRANT EXECUTE ON FUNCTION admin_create_registro(uuid, uuid, text, text, text, text) TO authenticated;



