-- ============================================
-- TABLA PÚBLICA DE USUARIOS REGISTRADOS
-- ============================================

-- Crear tabla pública para almacenar usuarios
CREATE TABLE IF NOT EXISTS public.registered_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  is_blocked BOOLEAN DEFAULT false,
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_registered_users_email ON public.registered_users(email);
CREATE INDEX IF NOT EXISTS idx_registered_users_created_at ON public.registered_users(created_at DESC);

-- IMPORTANTE: NO HABILITAR RLS PARA QUE SEA ACCESIBLE PÚBLICAMENTE
-- (Supabase bloqueará las queries sin RLS, así que necesitamos políticas específicas)

-- Permitir que CUALQUIERA lea la tabla (para el admin app)
ALTER TABLE public.registered_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read"
  ON public.registered_users FOR SELECT
  USING (true);

CREATE POLICY "Allow admin insert"
  ON public.registered_users FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = 'eskorbutinsoy@gmail.com');

CREATE POLICY "Allow admin update"
  ON public.registered_users FOR UPDATE
  USING (auth.jwt() ->> 'email' = 'eskorbutinsoy@gmail.com');

CREATE POLICY "Allow admin delete"
  ON public.registered_users FOR DELETE
  USING (auth.jwt() ->> 'email' = 'eskorbutinsoy@gmail.com');

-- Insertar usuarios de prueba IMPORTANTES
INSERT INTO public.registered_users (email, created_at, last_sign_in_at)
VALUES
  ('txuski_89@hotmail.com', NOW() - INTERVAL '30 days', NOW() - INTERVAL '2 days'),
  ('eskorbutinsoy@gmail.com', NOW() - INTERVAL '45 days', NOW() - INTERVAL '1 hour'),
  ('cazador1@example.com', NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 day'),
  ('cazador2@example.com', NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days'),
  ('cazador3@example.com', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- ¡LISTO! Los usuarios aparecerán en el Admin App
-- ============================================
