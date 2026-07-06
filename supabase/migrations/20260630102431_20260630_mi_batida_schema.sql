/*
# Mi Batida — Schema Completo (reordenado)
Crea primero todas las tablas, luego habilita RLS, luego crea todas las policies.
Evita el problema de referencias cruzadas entre tablas al definir policies.
*/

-- ========== TABLAS ==========

CREATE TABLE IF NOT EXISTS perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  foto text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  codigo_invitacion text UNIQUE NOT NULL,
  creador_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'finalizada')),
  cupo_jabali int4 NOT NULL DEFAULT 0,
  cupo_ciervo_macho int4 NOT NULL DEFAULT 0,
  cupo_ciervo_hembra int4 NOT NULL DEFAULT 0,
  cupo_ciervo_cria int4 NOT NULL DEFAULT 0,
  cupo_corzo_macho int4 NOT NULL DEFAULT 0,
  cupo_corzo_hembra int4 NOT NULL DEFAULT 0,
  cupo_corzo_cria int4 NOT NULL DEFAULT 0,
  cupo_zorro int4 NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  finalizada_at timestamptz
);

CREATE TABLE IF NOT EXISTS batida_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batida_id uuid NOT NULL REFERENCES batidas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(batida_id, user_id)
);

CREATE TABLE IF NOT EXISTS batida_miembros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batida_id uuid NOT NULL REFERENCES batidas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'postura' CHECK (tipo IN ('perrero', 'postura')),
  puesto_nombre text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activo', 'abandonado')),
  silenciado boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(batida_id, user_id)
);

CREATE TABLE IF NOT EXISTS batida_posiciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batida_id uuid NOT NULL REFERENCES batidas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat float8 NOT NULL,
  lng float8 NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(batida_id, user_id)
);

CREATE TABLE IF NOT EXISTS batida_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batida_id uuid NOT NULL REFERENCES batidas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  especie text NOT NULL,
  tipo_registro text NOT NULL CHECK (tipo_registro IN ('cazado', 'escapado', 'herido')),
  raza text,
  notas text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batida_rastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batida_id uuid NOT NULL REFERENCES batidas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat float8 NOT NULL,
  lng float8 NOT NULL,
  especie text NOT NULL,
  antiguedad text NOT NULL CHECK (antiguedad IN ('ahora', 'muy_fresca', 'vieja')),
  direccion float8 NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batida_chat_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batida_id uuid NOT NULL REFERENCES batidas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensaje text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batida_puestos_mapa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batida_id uuid NOT NULL REFERENCES batidas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  lat float8 NOT NULL,
  lng float8 NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ========== RLS ==========
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE batidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE batida_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE batida_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE batida_posiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE batida_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE batida_rastros ENABLE ROW LEVEL SECURITY;
ALTER TABLE batida_chat_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE batida_puestos_mapa ENABLE ROW LEVEL SECURITY;

-- ========== POLICIES: perfiles ==========
DROP POLICY IF EXISTS "perfiles_select" ON perfiles;
CREATE POLICY "perfiles_select" ON perfiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "perfiles_insert" ON perfiles;
CREATE POLICY "perfiles_insert" ON perfiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "perfiles_update" ON perfiles;
CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "perfiles_delete" ON perfiles;
CREATE POLICY "perfiles_delete" ON perfiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- ========== POLICIES: batidas ==========
DROP POLICY IF EXISTS "batidas_select" ON batidas;
CREATE POLICY "batidas_select" ON batidas FOR SELECT TO authenticated
  USING (
    creador_id = auth.uid()
    OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = id AND ba.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = id AND bm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "batidas_insert" ON batidas;
CREATE POLICY "batidas_insert" ON batidas FOR INSERT TO authenticated WITH CHECK (auth.uid() = creador_id);
DROP POLICY IF EXISTS "batidas_update" ON batidas;
CREATE POLICY "batidas_update" ON batidas FOR UPDATE TO authenticated
  USING (
    creador_id = auth.uid()
    OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = id AND ba.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "batidas_delete" ON batidas;
CREATE POLICY "batidas_delete" ON batidas FOR DELETE TO authenticated USING (creador_id = auth.uid());

-- ========== POLICIES: batida_admins ==========
DROP POLICY IF EXISTS "batida_admins_select" ON batida_admins;
CREATE POLICY "batida_admins_select" ON batida_admins FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM batida_admins ba2 WHERE ba2.batida_id = batida_id AND ba2.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "batida_admins_insert" ON batida_admins;
CREATE POLICY "batida_admins_insert" ON batida_admins FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM batidas b WHERE b.id = batida_id AND (
      b.creador_id = auth.uid()
      OR EXISTS (SELECT 1 FROM batida_admins ba2 WHERE ba2.batida_id = batida_id AND ba2.user_id = auth.uid())
    ))
  );
DROP POLICY IF EXISTS "batida_admins_update" ON batida_admins;
CREATE POLICY "batida_admins_update" ON batida_admins FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM batidas b WHERE b.id = batida_id AND b.creador_id = auth.uid()));
DROP POLICY IF EXISTS "batida_admins_delete" ON batida_admins;
CREATE POLICY "batida_admins_delete" ON batida_admins FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM batidas b WHERE b.id = batida_id AND b.creador_id = auth.uid())
    OR EXISTS (SELECT 1 FROM batida_admins ba2 WHERE ba2.batida_id = batida_id AND ba2.user_id = auth.uid())
  );

-- ========== POLICIES: batida_miembros ==========
DROP POLICY IF EXISTS "batida_miembros_select" ON batida_miembros;
CREATE POLICY "batida_miembros_select" ON batida_miembros FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM batida_miembros bm2 WHERE bm2.batida_id = batida_id AND bm2.user_id = auth.uid() AND bm2.estado = 'activo')
  );
DROP POLICY IF EXISTS "batida_miembros_insert" ON batida_miembros;
CREATE POLICY "batida_miembros_insert" ON batida_miembros FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "batida_miembros_update" ON batida_miembros;
CREATE POLICY "batida_miembros_update" ON batida_miembros FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "batida_miembros_delete" ON batida_miembros;
CREATE POLICY "batida_miembros_delete" ON batida_miembros FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
  );

-- ========== POLICIES: batida_posiciones ==========
DROP POLICY IF EXISTS "batida_posiciones_select" ON batida_posiciones;
CREATE POLICY "batida_posiciones_select" ON batida_posiciones FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid() AND bm.estado = 'activo')
  );
DROP POLICY IF EXISTS "batida_posiciones_insert" ON batida_posiciones;
CREATE POLICY "batida_posiciones_insert" ON batida_posiciones FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid() AND bm.estado = 'activo')
    )
  );
DROP POLICY IF EXISTS "batida_posiciones_update" ON batida_posiciones;
CREATE POLICY "batida_posiciones_update" ON batida_posiciones FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "batida_posiciones_delete" ON batida_posiciones;
CREATE POLICY "batida_posiciones_delete" ON batida_posiciones FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ========== POLICIES: batida_registros ==========
DROP POLICY IF EXISTS "batida_registros_select" ON batida_registros;
CREATE POLICY "batida_registros_select" ON batida_registros FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid() AND bm.estado = 'activo')
  );
DROP POLICY IF EXISTS "batida_registros_insert" ON batida_registros;
CREATE POLICY "batida_registros_insert" ON batida_registros FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid() AND bm.estado = 'activo')
    )
  );
DROP POLICY IF EXISTS "batida_registros_update" ON batida_registros;
CREATE POLICY "batida_registros_update" ON batida_registros FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid()));
DROP POLICY IF EXISTS "batida_registros_delete" ON batida_registros;
CREATE POLICY "batida_registros_delete" ON batida_registros FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid()));

-- ========== POLICIES: batida_rastros ==========
DROP POLICY IF EXISTS "batida_rastros_select" ON batida_rastros;
CREATE POLICY "batida_rastros_select" ON batida_rastros FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid() AND bm.estado = 'activo')
  );
DROP POLICY IF EXISTS "batida_rastros_insert" ON batida_rastros;
CREATE POLICY "batida_rastros_insert" ON batida_rastros FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid() AND bm.estado = 'activo')
    )
  );
DROP POLICY IF EXISTS "batida_rastros_update" ON batida_rastros;
CREATE POLICY "batida_rastros_update" ON batida_rastros FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid()));
DROP POLICY IF EXISTS "batida_rastros_delete" ON batida_rastros;
CREATE POLICY "batida_rastros_delete" ON batida_rastros FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid()));

-- ========== POLICIES: batida_chat_mensajes ==========
DROP POLICY IF EXISTS "chat_select" ON batida_chat_mensajes;
CREATE POLICY "chat_select" ON batida_chat_mensajes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid() AND bm.estado = 'activo')
  );
DROP POLICY IF EXISTS "chat_insert" ON batida_chat_mensajes;
CREATE POLICY "chat_insert" ON batida_chat_mensajes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM batida_miembros bm
        WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid()
        AND bm.estado = 'activo' AND bm.silenciado = false
      )
    )
  );
DROP POLICY IF EXISTS "chat_update" ON batida_chat_mensajes;
CREATE POLICY "chat_update" ON batida_chat_mensajes FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "chat_delete" ON batida_chat_mensajes;
CREATE POLICY "chat_delete" ON batida_chat_mensajes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid()));

-- ========== POLICIES: batida_puestos_mapa ==========
DROP POLICY IF EXISTS "puestos_select" ON batida_puestos_mapa;
CREATE POLICY "puestos_select" ON batida_puestos_mapa FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM batida_miembros bm WHERE bm.batida_id = batida_id AND bm.user_id = auth.uid() AND bm.estado = 'activo')
  );
DROP POLICY IF EXISTS "puestos_insert" ON batida_puestos_mapa;
CREATE POLICY "puestos_insert" ON batida_puestos_mapa FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid()));
DROP POLICY IF EXISTS "puestos_update" ON batida_puestos_mapa;
CREATE POLICY "puestos_update" ON batida_puestos_mapa FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid()));
DROP POLICY IF EXISTS "puestos_delete" ON batida_puestos_mapa;
CREATE POLICY "puestos_delete" ON batida_puestos_mapa FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM batida_admins ba WHERE ba.batida_id = batida_id AND ba.user_id = auth.uid()));

-- ========== TRIGGER auto-perfil ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre_completo, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_batidas_codigo ON batidas(codigo_invitacion);
CREATE INDEX IF NOT EXISTS idx_batidas_creador ON batidas(creador_id);
CREATE INDEX IF NOT EXISTS idx_miembros_batida ON batida_miembros(batida_id);
CREATE INDEX IF NOT EXISTS idx_miembros_user ON batida_miembros(user_id);
CREATE INDEX IF NOT EXISTS idx_posiciones_batida ON batida_posiciones(batida_id);
CREATE INDEX IF NOT EXISTS idx_registros_batida ON batida_registros(batida_id);
CREATE INDEX IF NOT EXISTS idx_rastros_batida ON batida_rastros(batida_id);
CREATE INDEX IF NOT EXISTS idx_chat_batida ON batida_chat_mensajes(batida_id, created_at);
CREATE INDEX IF NOT EXISTS idx_puestos_batida ON batida_puestos_mapa(batida_id);
