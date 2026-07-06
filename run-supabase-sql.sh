#!/bin/bash
# Script para ejecutar SQL en Supabase usando cURL

# Proyecto: abdwszaejrzqtjlvhakw (Mi Batida)
SUPABASE_URL="https://abdwszaejrzqtjlvhakw.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZHdzemFlancqcWx2aGFrdyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzE5OTI5MjM0LCJleHAiOjE5MzcxODk2MzR9.mLc1c0-zKHX2f82s9pZCzKRfCN9EqF5FY2jKJGQzHnc"

echo "📡 Intentando ejecutar SQL en Supabase..."
echo ""

# SQL a ejecutar
SQL="DROP FUNCTION IF EXISTS public.get_all_registered_users();
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

GRANT EXECUTE ON FUNCTION public.get_all_registered_users() TO authenticated;"

# Enviar a Supabase API
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"sql_string\": \"${SQL}\"}" \
  -v

echo ""
echo "✅ SQL enviada a Supabase"
