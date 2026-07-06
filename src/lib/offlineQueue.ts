import {
  addAlertaPerro,
  addMensaje,
  notifySosPush,
  addPuestoMapa,
  addRastro,
  upsertPosicion,
} from './db';
import { supabase } from './supabase';
import type { AlertaPerroTipo, AntiguedadRastro, EspecieRastro } from './types';

const OFFLINE_QUEUE_KEY = 'mi-batida-offline-queue';
export const OFFLINE_QUEUE_UPDATED_EVENT = 'mi-batida-offline-queue-updated';

export type OfflineQueueAction =
  | {
      id: string;
      type: 'chat_message';
      createdAt: string;
      payload: { batidaId: string; userId: string; mensaje: string; imagen_url?: string };
    }
  | {
      id: string;
      type: 'chat_image';
      createdAt: string;
      payload: { batidaId: string; userId: string; imageDataUrl: string; fileName: string };
    }
  | {
      id: string;
      type: 'sos_message';
      createdAt: string;
      payload: { batidaId: string; userId: string; mensaje: string };
    }
  | {
      id: string;
      type: 'position_update';
      createdAt: string;
      payload: { batidaId: string; userId: string; lat: number; lng: number };
    }
  | {
      id: string;
      type: 'rastro_create';
      createdAt: string;
      payload: {
        batidaId: string;
        userId: string;
        lat: number;
        lng: number;
        especie: EspecieRastro;
        antiguedad: AntiguedadRastro;
      };
    }
  | {
      id: string;
      type: 'puesto_create';
      createdAt: string;
      payload: { batidaId: string; nombre: string; lat: number; lng: number };
    }
  | {
      id: string;
      type: 'alerta_create';
      createdAt: string;
      payload: {
        batidaId: string;
        userId: string;
        tipo_alerta: AlertaPerroTipo;
        color?: string;
        propietario?: string;
        raza?: string;
        direccion?: string;
        mensaje?: string;
        lat?: number;
        lng?: number;
        gravedad?: string;
        imageDataUrl?: string;
        imageFileName?: string;
      };
    };

function parseQueue(raw: string | null): OfflineQueueAction[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OfflineQueueAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getOfflineQueue(): OfflineQueueAction[] {
  return parseQueue(localStorage.getItem(OFFLINE_QUEUE_KEY));
}

function saveOfflineQueue(queue: OfflineQueueAction[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT, { detail: { count: queue.length } }));
}

export function getOfflineQueueCount(): number {
  return getOfflineQueue().length;
}

export function enqueueOfflineAction(
  action: Omit<OfflineQueueAction, 'id' | 'createdAt'>,
): OfflineQueueAction {
  const queue = getOfflineQueue();
  const created: OfflineQueueAction = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  } as OfflineQueueAction;
  queue.push(created);
  saveOfflineQueue(queue);
  return created;
}

async function executeAction(action: OfflineQueueAction) {
  if (action.type === 'chat_message') {
    await addMensaje(action.payload.batidaId, action.payload.userId, action.payload.mensaje, action.payload.imagen_url);
    return;
  }

  if (action.type === 'chat_image') {
    const ext = action.payload.fileName.split('.').pop() || 'jpg';
    const path = `chat-images/${action.payload.batidaId}/${action.payload.userId}_${Date.now()}.${ext}`;
    const fileBlob = dataUrlToBlob(action.payload.imageDataUrl);
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, fileBlob, {
      contentType: fileBlob.type || 'image/jpeg',
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from('chat-images').getPublicUrl(path);
    const url = publicData?.publicUrl;
    if (!url) throw new Error('No se pudo generar URL publica para imagen de chat.');
    await addMensaje(action.payload.batidaId, action.payload.userId, '', url);
    return;
  }

  if (action.type === 'sos_message') {
    await addMensaje(action.payload.batidaId, action.payload.userId, action.payload.mensaje);
    await notifySosPush(action.payload.batidaId, action.payload.userId, action.payload.mensaje);
    return;
  }

  if (action.type === 'position_update') {
    await upsertPosicion(action.payload.batidaId, action.payload.userId, action.payload.lat, action.payload.lng);
    return;
  }

  if (action.type === 'rastro_create') {
    await addRastro(
      action.payload.batidaId,
      action.payload.userId,
      action.payload.lat,
      action.payload.lng,
      action.payload.especie,
      action.payload.antiguedad,
      0,
    );
    return;
  }

  if (action.type === 'puesto_create') {
    await addPuestoMapa(
      action.payload.batidaId,
      action.payload.nombre,
      action.payload.lat,
      action.payload.lng,
    );
    return;
  }

  if (action.type === 'alerta_create') {
    let imagenUrl: string | undefined;
    if (action.payload.imageDataUrl) {
      const ext = action.payload.imageFileName?.split('.').pop() || 'jpg';
      const path = `alertas-perros/${action.payload.batidaId}/${action.payload.userId}_${Date.now()}.${ext}`;
      const fileBlob = dataUrlToBlob(action.payload.imageDataUrl);
      const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, fileBlob, {
        contentType: fileBlob.type || 'image/jpeg',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('chat-images').getPublicUrl(path);
      imagenUrl = publicData?.publicUrl;
      if (!imagenUrl) throw new Error('No se pudo generar URL publica para imagen de alerta.');
    }

    await addAlertaPerro(
      action.payload.batidaId,
      action.payload.userId,
      action.payload.tipo_alerta,
      action.payload.color,
      action.payload.propietario,
      action.payload.raza,
      action.payload.direccion,
      action.payload.mensaje,
      imagenUrl,
      action.payload.lat,
      action.payload.lng,
      action.payload.gravedad,
    );
  }
}

function getPriority(action: OfflineQueueAction): number {
  if (action.type === 'sos_message') return 0;
  if (action.type === 'alerta_create') return 1;
  return 2;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  if (parts.length < 2) throw new Error('Data URL invalido.');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1]);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function flushOfflineQueue(): Promise<{ flushed: number; pending: number }> {
  if (!navigator.onLine) {
    return { flushed: 0, pending: getOfflineQueueCount() };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { flushed: 0, pending: 0 };
  const orderedQueue = [...queue].sort((a, b) => {
    const p = getPriority(a) - getPriority(b);
    if (p !== 0) return p;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const pending: OfflineQueueAction[] = [];
  let flushed = 0;

  for (const action of orderedQueue) {
    try {
      await executeAction(action);
      flushed += 1;
    } catch {
      pending.push(action);
    }
  }

  saveOfflineQueue(pending);
  return { flushed, pending: pending.length };
}
