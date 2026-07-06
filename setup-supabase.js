#!/usr/bin/env node

/**
 * Script para ejecutar SQL en Supabase y crear la función RPC
 * Uso: node setup-supabase.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://abdwszaejrzqtjlvhakw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZHdzemFlancqcWx2aGFrdyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzE5OTI5MjM0LCJleHAiOjE5MzcxODk2MzR9.mLc1c0-zKHX2f82s9pZCzKRfCN9EqF5FY2jKJGQzHnc';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  console.error('   Debes ejecutar esta SQL manualmente en Supabase SQL Editor:');
  console.log('\n' + require('fs').readFileSync('./SUPABASE_SQL_TO_RUN.sql', 'utf-8'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const sqlFunctionCreation = `
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
`;

async function setupSupabase() {
  try {
    console.log('📡 Conectando a Supabase...');
    console.log(`   URL: ${supabaseUrl}`);
    
    console.log('📝 Ejecutando SQL para crear función RPC...');
    
    // Ejecutar SQL usando la función rpc o query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_string: sqlFunctionCreation
    }).catch(() => {
      // Si exec_sql no existe, intentar otra forma
      return supabase.query(sqlFunctionCreation);
    });

    if (error) {
      throw error;
    }

    console.log('✅ ¡SQL ejecutada correctamente!');
    console.log('   La función RPC get_all_registered_users() está lista');
    console.log('   Los usuarios reales aparecerán en el Admin App ahora');
    
  } catch (err: any) {
    console.error('❌ Error ejecutando SQL:', err.message);
    console.error('\n📋 Debes ejecutar manualmente este SQL en Supabase:');
    console.log('\n' + sqlFunctionCreation);
    process.exit(1);
  }
}

setupSupabase();
