-- App Analytics Tables for Admin Dashboard

-- Tabla de sesiones de app (rastrear aperturas)
CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL, -- "Mi Batida" o "Mi Registro de Caza"
  app_version TEXT,
  platform TEXT, -- "web", "android", "ios"
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  device_info JSONB, -- User agent, device type, etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT app_sessions_valid_names CHECK (app_name IN ('Mi Batida', 'Mi Registro de Caza'))
);

-- Tabla de descargas de APK
CREATE TABLE IF NOT EXISTS app_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  app_name TEXT NOT NULL,
  version TEXT NOT NULL,
  platform TEXT DEFAULT 'android',
  download_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT app_downloads_valid_names CHECK (app_name IN ('Mi Batida', 'Mi Registro de Caza'))
);

-- Tabla de eventos de la app (clicks, navegación, etc)
CREATE TABLE IF NOT EXISTS app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- "screen_view", "button_click", "form_submit", "error", etc
  event_data JSONB, -- datos adicionales
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT app_events_valid_names CHECK (app_name IN ('Mi Batida', 'Mi Registro de Caza'))
);

-- Tabla de resumen de usuarios por app
CREATE TABLE IF NOT EXISTS app_user_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  total_sessions INT DEFAULT 0,
  last_session TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, app_name),
  CONSTRAINT app_user_summary_valid_names CHECK (app_name IN ('Mi Batida', 'Mi Registro de Caza'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_app_name ON app_sessions(app_name);
CREATE INDEX IF NOT EXISTS idx_app_sessions_created_at ON app_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_downloads_version ON app_downloads(version);
CREATE INDEX IF NOT EXISTS idx_app_downloads_created_at ON app_downloads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_user_id ON app_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_type ON app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events(created_at DESC);

-- RLS Policies
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user_summary ENABLE ROW LEVEL SECURITY;

-- Permitir a los usuarios ver solo sus propias sesiones
CREATE POLICY "Users can view their own sessions" 
  ON app_sessions FOR SELECT 
  USING (auth.uid() = user_id);

-- Permitir que los usuarios inserten sus propias sesiones
CREATE POLICY "Users can insert their own sessions" 
  ON app_sessions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Permitir que los usuarios vean sus propios eventos
CREATE POLICY "Users can view their own events" 
  ON app_events FOR SELECT 
  USING (auth.uid() = user_id);

-- Permitir que los usuarios inserten sus propios eventos
CREATE POLICY "Users can insert their own events" 
  ON app_events FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Para descargas, permitir inserción sin usuario autenticado
CREATE POLICY "Allow anonymous download tracking" 
  ON app_downloads FOR INSERT 
  WITH CHECK (true);

-- Permitir que usuarios vean sus propios descargas
CREATE POLICY "Users can view their own downloads" 
  ON app_downloads FOR SELECT 
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Para el resumen de usuarios, solo el propietario puede verlo
CREATE POLICY "Users can view their own summary" 
  ON app_user_summary FOR SELECT 
  USING (auth.uid() = user_id);
