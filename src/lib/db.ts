import { supabase } from './supabase';
import type {
  Batida, BatidaAdmin, BatidaMiembro, BatidaPosicion,
  BatidaRegistro, BatidaRastro, BatidaChatMensaje, BatidaPuestoMapa,
  BatidaEvento, BatidaEventoTipo,
  BatidaAlerta, AlertaPerroTipo,
  TipoRegistro, EspecieRastro, AntiguedadRastro, Perfil,
} from './types';

// ── Perfiles ──────────────────────────────────────────────────────────────────

function readCachedJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCachedJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const SECURITY_BACKUP_PREFIX = 'mi-batida-security-backup:';

export type SecurityBackup = {
  question: string;
  answerHash: string;
};

function securityBackupKey(email: string): string {
  return `${SECURITY_BACKUP_PREFIX}${email.toLowerCase().trim()}`;
}

export function saveSecurityBackup(email: string, backup: SecurityBackup): void {
  writeCachedJson(securityBackupKey(email), backup);
}

export function getSecurityBackup(email: string): SecurityBackup | null {
  return readCachedJson<SecurityBackup>(securityBackupKey(email));
}

export function clearSecurityBackup(email: string): void {
  try {
    localStorage.removeItem(securityBackupKey(email));
  } catch {
    /* ignore */
  }
}

export async function getPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Error al obtener perfil:', error);
    return null;
  }
  return data;
}

export async function upsertPerfil(userId: string, data: Partial<Perfil>): Promise<void> {
  const { error } = await supabase.from('perfiles').upsert({ id: userId, ...data });
  if (error) {
    console.error('Error al actualizar perfil:', error);
    throw error;
  }
}

export async function upsertPushDeviceToken(
  userId: string,
  token: string,
  platform: 'android' | 'ios' | 'web' = 'android',
): Promise<void> {
  const cleanToken = token.trim();
  if (!cleanToken) return;

  const { error } = await supabase
    .from('push_device_tokens')
    .upsert(
      {
        user_id: userId,
        token: cleanToken,
        platform,
        enabled: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

  if (error) {
    console.error('Error al registrar token push del dispositivo:', error);
  }
}

export async function notifySosPush(
  batidaId: string,
  senderUserId: string,
  message: string,
  lat?: number,
  lng?: number,
): Promise<{ ok: boolean; sent?: number; failed?: number; reason?: string; detail?: string }> {
  const { data, error } = await supabase.functions.invoke('send-sos-push', {
    body: {
      batidaId,
      senderUserId,
      message,
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
    },
  });

  if (error) {
    console.error('Error al disparar push SOS:', error);

    let detail = '';
    const errWithContext = error as { context?: Response; message?: string };
    if (errWithContext?.context) {
      try {
        const payload = await errWithContext.context.clone().json() as { error?: string };
        if (typeof payload?.error === 'string') detail = payload.error;
      } catch {
        try {
          detail = await errWithContext.context.clone().text();
        } catch {
          detail = errWithContext?.message || '';
        }
      }
    } else {
      detail = errWithContext?.message || '';
    }

    return { ok: false, reason: 'invoke_error', detail: detail.slice(0, 200) };
  }

  const ok = typeof (data as { ok?: unknown })?.ok === 'boolean'
    ? Boolean((data as { ok: boolean }).ok)
    : true;
  const reason = typeof (data as { reason?: unknown })?.reason === 'string'
    ? (data as { reason: string }).reason
    : undefined;
  const detail = typeof (data as { error?: unknown })?.error === 'string'
    ? (data as { error: string }).error
    : undefined;
  const sent = typeof (data as { sent?: unknown })?.sent === 'number'
    ? (data as { sent: number }).sent
    : undefined;
  const failed = typeof (data as { failed?: unknown })?.failed === 'number'
    ? (data as { failed: number }).failed
    : undefined;

  return {
    ok,
    sent,
    failed,
    reason,
    detail,
  };
}

export async function logBatidaEvento(
  batidaId: string,
  tipo: BatidaEventoTipo,
  titulo: string,
  detalle?: string,
  userId?: string | null,
): Promise<void> {
  const { error } = await supabase.from('batida_eventos').insert({
    batida_id: batidaId,
    tipo,
    titulo,
    detalle: detalle || null,
    user_id: userId ?? null,
  });
  if (error) {
    console.error('Error al registrar evento de batida:', error);
  }
}

export async function getBatidaEventos(batidaId: string): Promise<BatidaEvento[]> {
  const { data, error } = await supabase
    .from('batida_eventos')
    .select('*')
    .eq('batida_id', batidaId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error al obtener eventos de la batida:', error);
    return [];
  }
  return data || [];
}

export async function getSecurityQuestionByEmail(email: string): Promise<string | null> {
  const backup = getSecurityBackup(email);
  if (backup?.question?.trim()) return backup.question.trim();

  const { data, error } = await supabase.rpc('get_security_question_by_email', { p_email: email });
  if (error) {
    console.error('Error al obtener pregunta de seguridad:', error);
    return null;
  }
  return (typeof data === 'string' && data.trim()) ? data : null;
}

export type PasswordRecoveryResult =
  | { ok: true }
  | { ok: false; reason: 'wrong_answer' | 'server_not_ready' | 'server_error' };

export async function resetPasswordWithSecurityAnswer(
  email: string,
  answerHash: string,
  newPassword: string,
): Promise<PasswordRecoveryResult> {
  const { data, error } = await supabase.rpc('reset_password_with_security_answer', {
    p_email: email,
    p_answer_hash: answerHash,
    p_new_password: newPassword,
  });

  if (error) {
    console.error('Error al resetear contraseña por pregunta de seguridad:', error);

    const code = typeof (error as { code?: string }).code === 'string'
      ? (error as { code?: string }).code as string
      : '';

    if (code === 'PGRST202' || code === '42883') {
      return { ok: false, reason: 'server_not_ready' };
    }

    return { ok: false, reason: 'server_error' };
  }

  if (!data) {
    return { ok: false, reason: 'wrong_answer' };
  }

  return { ok: true };
}

// ── Batidas ───────────────────────────────────────────────────────────────────

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createBatida(
  nombre: string,
  cupos: Partial<Omit<Batida, 'id' | 'nombre' | 'codigo_invitacion' | 'creador_id' | 'estado' | 'created_at' | 'finalizada_at'>>
): Promise<Batida> {
  const codigo_invitacion = generateCode();
  console.log('Creando batida:', { nombre, codigo_invitacion, cupos });
  const { data, error } = await supabase
    .from('batidas')
    .insert({ nombre, codigo_invitacion, ...cupos })
    .select()
    .single();
  if (error) {
    console.error('Error Supabase al crear batida:', error);
    throw new Error(`Error al crear batida: ${error.message}`);
  }
  await logBatidaEvento(data.id, 'batida_creada', `Se creó la batida ${nombre}`, undefined, data.creador_id);
  return data;
}

export async function addAdminToBatida(batidaId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('batida_admins').insert({ batida_id: batidaId, user_id: userId });
  if (error) {
    console.error('Error al añadir administrador:', error);
    throw error;
  }
}

export async function getBatidaByCode(codigo: string): Promise<Batida | null> {
  const { data, error } = await supabase
    .from('batidas')
    .select('*')
    .eq('codigo_invitacion', codigo.toUpperCase())
    .eq('estado', 'activa')
    .maybeSingle();
  if (error) {
    console.error('Error al obtener batida por código:', error);
    return null;
  }
  return data;
}

export async function getBatida(id: string): Promise<Batida | null> {
  const { data, error } = await supabase.from('batidas').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('Error al obtener batida:', error);
    return null;
  }
  return data;
}

export async function getUserBatidas(userId: string): Promise<Batida[]> {
  try {
    const [creadas, adminDe, miembroDe] = await Promise.all([
      supabase.from('batidas').select('id').eq('creador_id', userId),
      supabase.from('batida_admins').select('batida_id').eq('user_id', userId),
      supabase.from('batida_miembros').select('batida_id').eq('user_id', userId),
    ]);

    const ids = new Set<string>();
    (creadas.data || []).forEach((b) => ids.add(b.id));
    (adminDe.data || []).forEach((a) => ids.add(a.batida_id));
    (miembroDe.data || []).forEach((m) => ids.add(m.batida_id));

    if (ids.size === 0) return [];
    
    const { data, error } = await supabase
      .from('batidas')
      .select('*')
      .in('id', Array.from(ids))
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error al obtener batidas del usuario:', error);
    return [];
  }
}

export async function updateBatida(id: string, updates: Partial<Batida>): Promise<void> {
  const { error } = await supabase.from('batidas').update(updates).eq('id', id);
  if (error) {
    console.error('Error al actualizar batida:', error);
    throw error;
  }
}

export async function finalizarBatida(id: string): Promise<void> {
  const { error } = await supabase
    .from('batidas')
    .update({ estado: 'finalizada', finalizada_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('Error al finalizar la batida:', error);
    throw error;
  }
  await logBatidaEvento(id, 'batida_finalizada', 'La batida fue finalizada');
}

// ── Admins ────────────────────────────────────────────────────────────────────

export async function getBatidaAdmins(batidaId: string): Promise<BatidaAdmin[]> {
  const { data, error } = await supabase.from('batida_admins').select('*').eq('batida_id', batidaId);
  if (error) {
    console.error('Error al obtener administradores de la batida:', error);
    return [];
  }
  return data || [];
}

export async function isAdmin(batidaId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('batida_admins')
    .select('id')
    .eq('batida_id', batidaId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Error en verificación de admin:', error);
    return false;
  }
  return !!data;
}

export async function promoverAdmin(batidaId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('batida_admins').insert({ batida_id: batidaId, user_id: userId });
  if (error) {
    console.error('Error al promover admin:', error);
    throw error;
  }
}

// ── Miembros ──────────────────────────────────────────────────────────────────

export async function joinBatida(
  batidaId: string, userId: string, tipo: 'perrero' | 'postura',
  puestoNombre?: string, estado: 'pendiente' | 'activo' = 'pendiente'
): Promise<BatidaMiembro> {
  const { data, error } = await supabase
    .from('batida_miembros')
    .insert({ batida_id: batidaId, user_id: userId, tipo, puesto_nombre: puestoNombre || null, estado })
    .select()
    .single();
  if (error) {
    console.error('Error al unirse a la batida:', error);
    throw error;
  }
  await logBatidaEvento(
    batidaId,
    'miembro_unido',
    'Un usuario se incorporó a la batida',
    `${tipo}${puestoNombre ? ` · ${puestoNombre}` : ''} · estado inicial: ${estado}`,
    userId,
  );
  return data;
}

// Optimización Relacional: Eliminada query N+1 secuencial por un Join directo de Supabase
export async function getMiBatidaMiembro(batidaId: string, userId: string): Promise<BatidaMiembro | null> {
  const { data, error } = await supabase
    .from('batida_miembros')
    .select('*')
    .eq('batida_id', batidaId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error al obtener miembro de la batida:', error);
    return null;
  }
  
  if (!data) return null;
  
  // Cargar el perfil
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, foto')
    .eq('id', userId)
    .maybeSingle();
  
  return { ...data, perfil: perfil || { id: userId, nombre_completo: null, foto: null } } as BatidaMiembro;
}

export async function getBatidaMiembros(batidaId: string): Promise<BatidaMiembro[]> {
  try {
    // Query 1: Obtener miembros
    const { data: miembros, error: miembrosError } = await supabase
      .from('batida_miembros')
      .select('*')
      .eq('batida_id', batidaId)
      .order('created_at', { ascending: true });
      
    if (miembrosError) throw miembrosError;
    if (!miembros || miembros.length === 0) return [];
    
    // Query 2: Obtener perfiles de todos los miembros
    const userIds = miembros.map((m) => m.user_id);
    const { data: perfiles, error: perfilesError } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, foto')
      .in('id', userIds);
    
    if (perfilesError) throw perfilesError;
    
    // Mapear perfiles y asignar a miembros
    const perfilMap = new Map((perfiles || []).map((p) => [p.id, p]));
    return miembros.map((m) => ({
      ...m,
      perfil: perfilMap.get(m.user_id) || { id: m.user_id, nombre_completo: null, foto: null }
    })) as BatidaMiembro[];
  } catch (error) {
    console.error('Error en listado de miembros de batida:', error);
    return [];
  }
}

export async function updateMiembroEstado(miembroId: string, estado: BatidaMiembro['estado']): Promise<void> {
  const { data: miembro, error: fetchError } = await supabase
    .from('batida_miembros')
    .select('batida_id, user_id, estado')
    .eq('id', miembroId)
    .maybeSingle();
  if (fetchError) {
    console.error('Error al leer miembro antes de actualizar estado:', fetchError);
    throw fetchError;
  }

  const { error } = await supabase.from('batida_miembros').update({ estado }).eq('id', miembroId);
  if (error) {
    console.error('Error al actualizar estado del miembro:', error);
    throw error;
  }
  if (miembro) {
    const tipoEvento = estado === 'activo' && miembro.estado !== 'activo' ? 'miembro_reactivado' : estado === 'abandonado' ? 'miembro_abandono' : 'miembro_unido';
    const titulo = estado === 'activo' && miembro.estado !== 'activo'
      ? 'Un usuario se reincorporó a la batida'
      : estado === 'abandonado'
        ? 'Un usuario abandonó la batida'
        : 'Estado de miembro actualizado';
    await logBatidaEvento(miembro.batida_id, tipoEvento, titulo, `Estado anterior: ${miembro.estado} · nuevo estado: ${estado}`, miembro.user_id);
  }
}

export async function updateMiembroSilenciado(miembroId: string, silenciado: boolean): Promise<void> {
  const { error } = await supabase.from('batida_miembros').update({ silenciado }).eq('id', miembroId);
  if (error) {
    console.error('Error al modificar silenciamiento del miembro:', error);
    throw error;
  }
}

export async function updateMiembroPuesto(miembroId: string, puesto_nombre: string | null, tipo: 'perrero' | 'postura'): Promise<void> {
  const { error } = await supabase.from('batida_miembros').update({ puesto_nombre, tipo }).eq('id', miembroId);
  if (error) {
    console.error('Error al actualizar el puesto del miembro:', error);
    throw error;
  }
}

export async function expulsarMiembro(miembroId: string): Promise<void> {
  const { error } = await supabase.from('batida_miembros').delete().eq('id', miembroId);
  if (error) {
    console.error('Error al expulsar/eliminar miembro:', error);
    throw error;
  }
}

// ── Posiciones GPS ────────────────────────────────────────────────────────────

export async function upsertPosicion(batidaId: string, userId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase.from('batida_posiciones').upsert(
    { batida_id: batidaId, user_id: userId, lat, lng, updated_at: new Date().toISOString() },
    { onConflict: 'batida_id,user_id' }
  );
  if (error) {
    console.error('Error en tracking GPS (Upsert):', error);
  }
}

export async function getPosiciones(batidaId: string): Promise<BatidaPosicion[]> {
  const cacheKey = `mi-batida-cache:posiciones:${batidaId}`;
  const { data, error } = await supabase
    .from('batida_posiciones')
    .select('*')
    .eq('batida_id', batidaId);
  if (error) {
    console.error('Error al extraer posiciones GPS:', error);
    return readCachedJson<BatidaPosicion[]>(cacheKey) || [];
  }
  const rows = data || [];
  writeCachedJson(cacheKey, rows);
  return rows;
}

// ── Registros ─────────────────────────────────────────────────────────────────

export async function addRegistro(
  batidaId: string, userId: string,
  especie: string, tipo_registro: TipoRegistro, raza?: string, notas?: string
): Promise<BatidaRegistro> {
  const { data, error } = await supabase
    .from('batida_registros')
    .insert({ batida_id: batidaId, user_id: userId, especie, tipo_registro, raza: raza || null, notas: notas || null })
    .select()
    .single();
  if (error) {
    console.error('Error al añadir registro/lance:', error);
    throw error;
  }
  await logBatidaEvento(
    batidaId,
    'registro_creado',
    'Se registró un lance',
    `${tipo_registro} · ${especie}${raza ? ` · ${raza}` : ''}${notas ? ` · ${notas}` : ''}`,
    userId,
  );
  return data;
}

export async function getRegistros(batidaId: string): Promise<BatidaRegistro[]> {
  const cacheKey = `mi-batida-cache:registros:${batidaId}`;
  const { data, error } = await supabase
    .from('batida_registros')
    .select('*')
    .eq('batida_id', batidaId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error al obtener registros:', error);
    return readCachedJson<BatidaRegistro[]>(cacheKey) || [];
  }
  const rows = data || [];
  writeCachedJson(cacheKey, rows);
  return rows;
}

export async function deleteRegistro(registroId: string): Promise<void> {
  const { error } = await supabase.from('batida_registros').delete().eq('id', registroId);
  if (error) {
    console.error('Error al eliminar registro:', error);
    throw error;
  }
}

// ── Rastros ───────────────────────────────────────────────────────────────────

export async function addRastro(
  batidaId: string, userId: string,
  lat: number, lng: number,
  especie: EspecieRastro, antiguedad: AntiguedadRastro, direccion: number
): Promise<BatidaRastro> {
  const { data, error } = await supabase
    .from('batida_rastros')
    .insert({ batida_id: batidaId, user_id: userId, lat, lng, especie, antiguedad, direccion })
    .select()
    .single();
  if (error) {
    console.error('Error al registrar rastro:', error);
    throw error;
  }
  return data;
}

export async function getRastros(batidaId: string): Promise<BatidaRastro[]> {
  const cacheKey = `mi-batida-cache:rastros:${batidaId}`;
  const { data, error } = await supabase
    .from('batida_rastros')
    .select('*')
    .eq('batida_id', batidaId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error al leer rastros:', error);
    return readCachedJson<BatidaRastro[]>(cacheKey) || [];
  }
  const rows = data || [];
  writeCachedJson(cacheKey, rows);
  return rows;
}

export async function deleteRastro(id: string): Promise<void> {
  const { error } = await supabase.from('batida_rastros').delete().eq('id', id);
  if (error) {
    console.error('Error al borrar rastro:', error);
    throw error;
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function getChatMensajes(batidaId: string): Promise<BatidaChatMensaje[]> {
  const cacheKey = `mi-batida-cache:mensajes:${batidaId}`;
  // Query 1: mensajes
  const { data: mensajes, error } = await supabase
    .from('batida_chat_mensajes')
    .select('*')
    .eq('batida_id', batidaId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    console.error('Error al recuperar mensajes del chat:', error);
    return readCachedJson<BatidaChatMensaje[]>(cacheKey) || [];
  }
  if (!mensajes || mensajes.length === 0) return [];

  // Query 2: perfiles de los autores
  const userIds = [...new Set(mensajes.map((m) => m.user_id))];
  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, foto')
    .in('id', userIds);

  const perfilMap = new Map((perfiles || []).map((p) => [p.id, p]));
  const rows = mensajes.map((m) => ({
    ...m,
    perfil: perfilMap.get(m.user_id) || { id: m.user_id, nombre_completo: null, foto: null },
  })) as BatidaChatMensaje[];
  writeCachedJson(cacheKey, rows);
  return rows;
}

export async function sendChatMensaje(batidaId: string, userId: string, mensaje: string, imagen_url?: string): Promise<BatidaChatMensaje> {
  const { data, error } = await supabase
    .from('batida_chat_mensajes')
    .insert({ batida_id: batidaId, user_id: userId, mensaje, imagen_url: imagen_url ?? null })
    .select()
    .single();
  if (error) {
    console.error('Error al enviar mensaje del chat:', error);
    throw error;
  }
  return data;
}

export async function deleteChatMensaje(mensajeId: string): Promise<void> {
  const { error } = await supabase.from('batida_chat_mensajes').delete().eq('id', mensajeId);
  if (error) {
    console.error('Error al borrar mensaje del chat:', error);
    throw error;
  }
}

export async function getAlertasPerro(batidaId: string): Promise<BatidaAlerta[]> {
  const cacheKey = `mi-batida-cache:alertas:${batidaId}`;
  const { data, error } = await supabase
    .from('batida_alertas')
    .select('*, perfil:perfiles(nombre_completo, foto)')
    .eq('batida_id', batidaId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error al recuperar alertas de perros:', error);
    return readCachedJson<BatidaAlerta[]>(cacheKey) || [];
  }
  const rows = data || [];
  writeCachedJson(cacheKey, rows);
  return rows;
}

export async function addAlertaPerro(
  batidaId: string,
  userId: string,
  tipo_alerta: AlertaPerroTipo,
  color?: string,
  propietario?: string,
  raza?: string,
  direccion?: string,
  mensaje?: string,
  imagen_url?: string,
  lat?: number,
  lng?: number,
  gravedad?: string,
): Promise<BatidaAlerta> {
  const { data, error } = await supabase
    .from('batida_alertas')
    .insert({
      batida_id: batidaId,
      user_id: userId,
      tipo_alerta,
      color: color || null,
      propietario: propietario || null,
      raza: raza || null,
      direccion: direccion || null,
      mensaje: mensaje || null,
      imagen_url: imagen_url ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      gravedad: gravedad || null,
    })
    .select()
    .single();
  if (error) {
    console.error('Error al enviar alerta de perro:', error);
    throw error;
  }
  return data;
}

export async function deleteAlertaPerro(id: string): Promise<void> {
  const { error } = await supabase.from('batida_alertas').delete().eq('id', id);
  if (error) {
    console.error('Error al eliminar alerta de perro:', error);
    throw error;
  }
}

// Backwards-compatible wrappers (nombres usados en UI)
export async function getMensajes(batidaId: string): Promise<BatidaChatMensaje[]> {
  return getChatMensajes(batidaId);
}

export async function addMensaje(batidaId: string, userId: string, mensaje: string, imagen_url?: string): Promise<BatidaChatMensaje> {
  return sendChatMensaje(batidaId, userId, mensaje, imagen_url);
}

export async function deleteMensaje(mensajeId: string): Promise<void> {
  return deleteChatMensaje(mensajeId);
}

// Eliminar una batida y datos relacionados (para historial)
export async function deleteBatida(batidaId: string): Promise<void> {
  try {
    // Borrar registros relacionados primero para evitar FK issues
    await Promise.all([
      supabase.from('batida_miembros').delete().eq('batida_id', batidaId),
      supabase.from('batida_admins').delete().eq('batida_id', batidaId),
      supabase.from('batida_puestos_mapa').delete().eq('batida_id', batidaId),
      supabase.from('batida_posiciones').delete().eq('batida_id', batidaId),
      supabase.from('batida_registros').delete().eq('batida_id', batidaId),
      supabase.from('batida_rastros').delete().eq('batida_id', batidaId),
      supabase.from('batida_chat_mensajes').delete().eq('batida_id', batidaId),
    ]);
    const { error } = await supabase.from('batidas').delete().eq('id', batidaId);
    if (error) throw error;
  } catch (error) {
    console.error('Error al eliminar batida y sus datos:', error);
    throw error;
  }
}

// ── Puestos Mapa ──────────────────────────────────────────────────────────────

export async function getPuestosMapa(batidaId: string): Promise<BatidaPuestoMapa[]> {
  const cacheKey = `mi-batida-cache:puestos:${batidaId}`;
  const { data, error } = await supabase
    .from('batida_puestos_mapa')
    .select('*')
    .eq('batida_id', batidaId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error al recuperar puestos de mapa:', error);
    return readCachedJson<BatidaPuestoMapa[]>(cacheKey) || [];
  }
  const rows = data || [];
  writeCachedJson(cacheKey, rows);
  return rows;
}

export async function addPuestoMapa(batidaId: string, nombre: string, lat: number, lng: number): Promise<BatidaPuestoMapa> {
  const { data, error } = await supabase
    .from('batida_puestos_mapa')
    .insert({ batida_id: batidaId, nombre, lat, lng })
    .select()
    .single();
  if (error) {
    console.error('Error al añadir puesto en mapa:', error);
    throw error;
  }
  return data;
}

export async function deletePuestoMapa(id: string): Promise<void> {
  const { error } = await supabase.from('batida_puestos_mapa').delete().eq('id', id);
  if (error) {
    console.error('Error al eliminar puesto de mapa:', error);
    throw error;
  }
}

// Elimina la participación de un usuario en una batida (quitar de "Mi historial")
export async function removeUserFromBatida(batidaId: string, userId: string): Promise<void> {
  try {
    // Borrar como miembro y como admin (si lo era)
    await Promise.all([
      supabase.from('batida_miembros').delete().eq('batida_id', batidaId).eq('user_id', userId),
      supabase.from('batida_admins').delete().eq('batida_id', batidaId).eq('user_id', userId),
    ]);
    await logBatidaEvento(batidaId, 'miembro_abandono', 'Un usuario salió de la batida', undefined, userId);
  } catch (error) {
    console.error('Error al quitar usuario de batida:', error);
    throw error;
  }
}

export async function removeUserFromBatidaHistory(batidaId: string, userId: string): Promise<void> {
  try {
    await Promise.all([
      supabase.from('batida_miembros').delete().eq('batida_id', batidaId).eq('user_id', userId),
      supabase.from('batida_admins').delete().eq('batida_id', batidaId).eq('user_id', userId),
    ]);
  } catch (error) {
    console.error('Error al quitar usuario del historial de batida:', error);
    throw error;
  }
}

export async function removeAdminFromBatida(batidaId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('batida_admins').delete().eq('batida_id', batidaId).eq('user_id', userId);
  if (error) {
    console.error('Error al quitar admin de batida:', error);
    throw error;
  }
}