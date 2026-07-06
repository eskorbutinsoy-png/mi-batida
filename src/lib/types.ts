export interface Perfil {
  id: string;
  nombre_completo: string;
  email: string;
  foto: string | null;
  pregunta_seguridad?: string | null;
  respuesta_seguridad_hash?: string | null;
  created_at: string;
}

export interface Batida {
  id: string;
  nombre: string;
  codigo_invitacion: string;
  creador_id: string;
  estado: 'activa' | 'finalizada';
  cupo_jabali: number;
  cupo_ciervo_macho: number;
  cupo_ciervo_hembra: number;
  cupo_ciervo_cria: number;
  cupo_corzo_macho: number;
  cupo_corzo_hembra: number;
  cupo_corzo_cria: number;
  cupo_zorro: number;
  cupos_custom: Record<string, number>;
  especies_autorizadas: string[];
  created_at: string;
  finalizada_at: string | null;
}

export interface BatidaAdmin {
  id: string;
  batida_id: string;
  user_id: string;
  created_at: string;
}

export interface BatidaMiembro {
  id: string;
  batida_id: string;
  user_id: string;
  tipo: 'perrero' | 'postura';
  puesto_nombre: string | null;
  estado: 'activo' | 'abandonado' | 'pendiente';
  silenciado: boolean;
  created_at: string;
  perfil?: { nombre_completo: string; foto: string | null };
}

export interface BatidaPosicion {
  id: string;
  batida_id: string;
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}

export type EspecieRegistro =
  // Legacy value kept for backward compatibility with old rows.
  | 'jabali'
  | 'jabali_macho' | 'jabali_hembra' | 'jabali_cria'
  | 'ciervo_macho' | 'ciervo_hembra' | 'ciervo_cria'
  | 'corzo_macho' | 'corzo_hembra' | 'corzo_cria'
  | 'zorro';

export type TipoRegistro = 'cazado' | 'escapado' | 'herido';
export type EspecieRastro = 'jabali' | 'ciervo' | 'corzo' | 'zorro';
export type AntiguedadRastro = 'ahora' | 'muy_fresca' | 'vieja';

export interface BatidaRegistro {
  id: string;
  batida_id: string;
  user_id: string;
  especie: EspecieRegistro;
  tipo_registro: TipoRegistro;
  raza: string | null;
  notas: string | null;
  created_at: string;
}

export interface BatidaRastro {
  id: string;
  batida_id: string;
  user_id: string;
  lat: number;
  lng: number;
  especie: EspecieRastro;
  antiguedad: AntiguedadRastro;
  direccion: number;
  created_at: string;
}

export interface BatidaChatMensaje {
  id: string;
  batida_id: string;
  user_id: string;
  mensaje: string;
  imagen_url: string | null;
  created_at: string;
  perfil?: { nombre_completo: string; foto: string | null } | null;
}

// Backwards-compatible alias used across the UI
export type BatidaMensaje = BatidaChatMensaje;

export type AlertaPerroTipo = 'perro_cogido' | 'perro_visto' | 'perro_por_la_zona';

export interface BatidaAlerta {
  id: string;
  batida_id: string;
  user_id: string;
  tipo_alerta: AlertaPerroTipo;
  color: string | null;
  raza: string | null;
  propietario: string | null;
  direccion: string | null;
  mensaje: string | null;
  imagen_url: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  perfil?: { nombre_completo: string; foto: string | null } | null;
}

export interface BatidaPuestoMapa {
  id: string;
  batida_id: string;
  nombre: string;
  lat: number;
  lng: number;
  created_at: string;
}

export type BatidaEventoTipo =
  | 'batida_creada'
  | 'batida_iniciada'
  | 'batida_finalizada'
  | 'miembro_unido'
  | 'miembro_reactivado'
  | 'miembro_abandono'
  | 'miembro_expulsado'
  | 'registro_creado';

export interface BatidaEvento {
  id: string;
  batida_id: string;
  tipo: BatidaEventoTipo;
  user_id: string | null;
  titulo: string;
  detalle: string | null;
  created_at: string;
}

export const ESPECIE_LABELS: Record<EspecieRegistro, string> = {
  jabali: 'Jabalí Macho',
  jabali_macho: 'Jabalí Macho',
  jabali_hembra: 'Jabalí Hembra',
  jabali_cria: 'Jabalí Cría',
  ciervo_macho: 'Ciervo Macho',
  ciervo_hembra: 'Ciervo Hembra',
  ciervo_cria: 'Ciervo Cría',
  corzo_macho: 'Corzo Macho',
  corzo_hembra: 'Corzo Hembra',
  corzo_cria: 'Corzo Cría',
  zorro: 'Zorro',
};

export const ESPECIE_RASTRO_LABELS: Record<EspecieRastro, string> = {
  jabali: 'Jabalí', ciervo: 'Ciervo', corzo: 'Corzo', zorro: 'Zorro',
};

export const TIPO_REGISTRO_LABELS: Record<TipoRegistro, string> = {
  cazado: 'Cazado', escapado: 'Escapado', herido: 'Herido',
};

export const ANTIGUEDAD_LABELS: Record<AntiguedadRastro, string> = {
  ahora: 'Ahora mismo', muy_fresca: 'Muy fresca', vieja: 'Vieja',
};

export const ESPECIE_A_CUPO: Partial<Record<EspecieRegistro, keyof Batida>> = {
  jabali: 'cupo_jabali',
  jabali_macho: 'cupo_jabali',
  jabali_hembra: 'cupo_jabali',
  jabali_cria: 'cupo_jabali',
  ciervo_macho: 'cupo_ciervo_macho',
  ciervo_hembra: 'cupo_ciervo_hembra',
  ciervo_cria: 'cupo_ciervo_cria',
  corzo_macho: 'cupo_corzo_macho',
  corzo_hembra: 'cupo_corzo_hembra',
  corzo_cria: 'cupo_corzo_cria',
  zorro: 'cupo_zorro',
};

export const ESPECIE_EMOJIS: Record<EspecieRegistro, string> = {
  jabali: '🐗',
  jabali_macho: '🐗',
  jabali_hembra: '🐗',
  jabali_cria: '🐗',
  ciervo_macho: '🦌',
  ciervo_hembra: '🦌',
  ciervo_cria: '🦌',
  corzo_macho: '🦌',
  corzo_hembra: '🦌',
  corzo_cria: '🦌',
  zorro: '🦊',
};

export function normalizeEspecieRegistro(especie: string): string {
  // Backward compatibility for old rows saved as "jabali".
  return especie === 'jabali' ? 'jabali_macho' : especie;
}

// Helper: obtener label de especie (predefinida o custom)
export function getEspecieLabel(especie: string): string {
  const key = normalizeEspecieRegistro(especie);
  return (ESPECIE_LABELS as Record<string, string>)[key] || key;
}

// Helper: obtener emoji de especie (predefinida o custom)
export function getEspecieEmoji(especie: string): string {
  const key = normalizeEspecieRegistro(especie);
  return (ESPECIE_EMOJIS as Record<string, string>)[key] || '🎯';
}

export const ALERTA_PERRO_LABELS: Record<AlertaPerroTipo, string> = {
  perro_cogido: 'Perro cogido',
  perro_visto: 'Perro visto',
  perro_por_la_zona: 'Perro por la zona',
};

export const ALERTA_PERRO_EMOJIS: Record<AlertaPerroTipo, string> = {
  perro_cogido: '🐕‍🦺',
  perro_visto: '👀',
  perro_por_la_zona: '📍',
};
