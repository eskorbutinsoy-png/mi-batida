# 📋 INSTRUCCIONES PARA HACER APARECER LOS USUARIOS REALES

## El problema:
El Admin App intenta obtener usuarios de una función RPC que aún no existe en Supabase.

## La solución - 3 pasos simples:

### PASO 1: Abre Supabase SQL Editor
Ve a: https://supabase.com/dashboard/project/abdwszaejrzqtjlvhakw/sql

### PASO 2: Copia y pega este SQL:
```sql
DROP FUNCTION IF EXISTS public.get_all_registered_users();

CREATE FUNCTION public.get_all_registered_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'eskorbutinsoy@gmail.com' THEN
    RAISE EXCEPTION 'Solo el admin puede acceder a esta función';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_all_registered_users() TO authenticated;
```

### PASO 3: Ejecuta (Ctrl+Enter o botón RUN)

## ✅ ¡Listo!
Ahora abre la app y verás todos los usuarios:
- txuski_89@hotmail.com
- eskorbutinsoy@gmail.com
- Y cualquier otro usuario registrado
