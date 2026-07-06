-- ============================================
-- EJECUTAR ESTE SQL EN SUPABASE PARA QUE APAREZCAN LOS USUARIOS REALES
-- ============================================

-- 1. CREAR FUNCIÓN RPC PARA OBTENER TODOS LOS USUARIOS
DROP FUNCTION IF EXISTS public.get_all_registered_users();

CREATE FUNCTION public.get_all_registered_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Solo permitir al admin
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'eskorbutinsoy@gmail.com' THEN
    RAISE EXCEPTION 'Solo el admin puede acceder a esta función';
  END IF;

  -- Devolver todos los usuarios de auth.users
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que usuarios autenticados ejecuten esta función
GRANT EXECUTE ON FUNCTION public.get_all_registered_users() TO authenticated;

-- ============================================
-- ¡LISTO! Ahora los usuarios aparecerán en Admin App
-- ============================================
