import { useEffect, useState, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getMensajes, addMensaje } from '../lib/db';
import { enqueueOfflineAction } from '../lib/offlineQueue';
import type { BatidaMiembro, BatidaMensaje } from '../lib/types';
import {
  parseSharedOfflineMapMessage,
  downloadSharedOfflineMap,
  saveOfflineMap,
  type SharedOfflineMapPayload,
} from '../lib/offlineMaps';
import { Send, Loader2, RefreshCw } from 'lucide-react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

interface Props {
  batidaId: string;
  miembros: BatidaMiembro[];
  miMiembro: BatidaMiembro | null;
  isAdmin: boolean;
  active: boolean;
  onUnreadChange: Dispatch<SetStateAction<number>>;
  onBack: () => void;
}

export default function ChatSection({ batidaId, active, onUnreadChange }: Props) {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState<BatidaMensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingMapMsgId, setDownloadingMapMsgId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const cargarMensajes = useCallback(async (showLoader = false) => {
    if (showLoader) setRefreshing(true);
    try {
      const data = await getMensajes(batidaId);
      const sorted = data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMensajes(sorted);
      
      // Si no estamos en chat y hay mensajes nuevos, incrementar contador
      if (!active && sorted.length > lastCountRef.current) {
        const diff = sorted.length - lastCountRef.current;
        onUnreadChange(prev => prev + diff);
      }
      lastCountRef.current = sorted.length;
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    } finally {
      setRefreshing(false);
    }
  }, [batidaId, active, onUnreadChange]);

  useEffect(() => {
    cargarMensajes();

    const channel = supabase
      .channel(`chat-${batidaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'batida_chat_mensajes', filter: `batida_id=eq.${batidaId}` },
        () => { cargarMensajes(); }
      )
      .subscribe();

    const interval = setInterval(() => cargarMensajes(), 3000);

    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [batidaId, cargarMensajes]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes]);

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderMessageWithLinks(message: string) {
    const parts = message.split(URL_REGEX);
    return parts.map((part, idx) => {
      if (part.match(URL_REGEX)) {
        return (
          <a
            key={`link-${idx}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={`text-${idx}`}>{part}</span>;
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || !user || loading) return;
    setLoading(true);
    const cleanText = texto.trim();
    try {
      await addMensaje(batidaId, user.id, cleanText);
      setTexto('');
      await cargarMensajes();
    } catch (err) {
      enqueueOfflineAction({
        type: 'chat_message',
        payload: {
          batidaId,
          userId: user.id,
          mensaje: cleanText,
        },
      });
      setTexto('');
      alert('Sin conexión. Mensaje guardado y pendiente de envío.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageSelect(file?: File) {
    if (!file || !user) return;
    setLoading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `chat-images/${batidaId}/${user.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('chat-images').upload(path, file);
      if (upErr) {
        throw new Error(upErr.message || 'Error subiendo imagen');
      }
      const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(path);
      const url = pub.publicUrl;
      if (!url) {
        throw new Error('No se pudo generar URL de imagen');
      }
      await addMensaje(batidaId, user.id, '', url);
      await cargarMensajes();
    } catch (err) {
      try {
        const imageDataUrl = await fileToDataUrl(file);
        enqueueOfflineAction({
          type: 'chat_image',
          payload: {
            batidaId,
            userId: user.id,
            imageDataUrl,
            fileName: file.name || 'imagen.jpg',
          },
        });
        alert('Sin conexión. Imagen guardada y pendiente de envío.');
      } catch {
        alert('No se pudo guardar la imagen para envío offline.');
      }
      console.error('Error en handleImageSelect:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadSharedMap(msgId: string, payload: SharedOfflineMapPayload) {
    if (downloadingMapMsgId) return;
    setDownloadingMapMsgId(msgId);
    try {
      const result = await downloadSharedOfflineMap(payload);
      saveOfflineMap({
        name: payload.name,
        layerKind: payload.layerKind,
        bounds: payload.bounds,
        minZoom: payload.minZoom,
        maxZoom: payload.maxZoom,
        downloadedTiles: result.downloaded,
        failedTiles: result.failed,
        totalTiles: result.total,
      });
      alert(`Mapa offline guardado: ${payload.name} (${result.downloaded}/${result.total}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo descargar el mapa offline compartido.';
      alert(message);
    } finally {
      setDownloadingMapMsgId(null);
    }
  }

  return (
    <div className="flex flex-col h-full bg-forest text-white">
      <div className="bg-gradient-to-r from-forest-dark to-forest px-4 py-4 border-b-2 border-amber flex items-center justify-between shrink-0 shadow-lg">
        <div>
          <h2 className="font-black text-lg">💬 Canal de la Línea</h2>
          <p className="text-sm text-forest-light mt-1">Mensajes en tiempo real de la montería</p>
        </div>
        <button type="button" onClick={() => cargarMensajes(true)} disabled={refreshing}
          className="p-2.5 text-amber hover:text-amber-light rounded-xl bg-forest-dark/70 border-2 border-amber/30 transition-all hover:border-amber/60" title="Actualizar chat">
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-forest to-forest-dark/50">
        {mensajes.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-forest-light text-lg font-bold">Sin mensajes</p>
              <p className="text-forest-muted text-sm mt-2">Sé el primero en escribir</p>
            </div>
          </div>
        )}
        {mensajes.map((msg) => {
          const isMe = msg.user_id === user?.id;
          const nombre = msg.perfil?.nombre_completo || 'Cazador';
          const sharedMap = msg.mensaje ? parseSharedOfflineMapMessage(msg.mensaje) : null;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-forest-muted mb-1.5 px-2 font-bold">{nombre}</span>
              <div className={`max-w-xs rounded-2xl px-4 py-3 text-sm shadow-lg border-2 ${isMe ? 'bg-gradient-to-r from-amber to-amber-light text-forest-dark rounded-br-none border-amber' : 'bg-forest-dark text-white rounded-bl-none border-forest-border'}`}>
                {msg.imagen_url ? (
                  <img src={msg.imagen_url} alt="imagen" className="max-w-full rounded-xl mb-2 border border-white/20" />
                ) : null}
                {sharedMap ? (
                  <div className={`rounded-xl border-2 p-3 space-y-2 ${isMe ? 'border-forest-dark/20 bg-white/35' : 'border-cyan-700/50 bg-cyan-950/30'}`}>
                    <p className={`text-xs font-black ${isMe ? 'text-forest-dark' : 'text-cyan-200'}`}>🗺️ Mapa offline compartido</p>
                    <p className={`text-sm font-black ${isMe ? 'text-forest-dark' : 'text-white'}`}>{sharedMap.name}</p>
                    <p className={`text-[11px] ${isMe ? 'text-forest-dark/80' : 'text-forest-muted'}`}>
                      Capa: {sharedMap.layerKind === 'hybrid' ? 'Satélite híbrido' : sharedMap.layerKind === 'satellite' ? 'Satélite' : 'Calles'} · Zoom {sharedMap.minZoom}-{sharedMap.maxZoom}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownloadSharedMap(msg.id, sharedMap)}
                      disabled={downloadingMapMsgId === msg.id}
                      className={`w-full py-2 rounded-lg border-2 font-black text-xs transition-all ${isMe ? 'border-forest-dark/25 bg-forest-dark/10 text-forest-dark hover:bg-forest-dark/20' : 'border-cyan-500/60 text-cyan-100 hover:bg-cyan-500/10'} disabled:opacity-60`}
                    >
                      {downloadingMapMsgId === msg.id ? 'Descargando mapa...' : 'Descargar mapa offline'}
                    </button>
                  </div>
                ) : msg.mensaje ? (
                  <p className="break-words whitespace-pre-wrap leading-relaxed">{renderMessageWithLinks(msg.mensaje)}</p>
                ) : null}
                <span className={`block text-xs mt-2 text-right font-medium ${isMe ? 'text-forest-dark/60' : 'text-forest-muted'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 bg-gradient-to-r from-forest-dark to-forest border-t-2 border-amber flex gap-2.5 shrink-0 shadow-lg">
        <input type="file" accept="image/*" capture="environment" ref={el => fileInputRef.current = el}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); e.currentTarget.value = ''; }}
          className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} title="Enviar foto" className="p-3 bg-forest border-2 border-forest-border hover:border-amber text-amber text-xl rounded-xl transition-all duration-200 hover:bg-forest-hover">
          📷
        </button>
        <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe un mensaje al grupo..."
          className="flex-1 bg-forest-dark border-2 border-forest-border rounded-xl px-4 py-3 text-sm text-white placeholder-forest-muted outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200" />
        <button type="submit" disabled={loading || !texto.trim()} className="bg-gradient-to-r from-amber to-amber-light hover:from-amber-light hover:to-amber disabled:opacity-60 text-forest-dark font-black p-3 rounded-xl transition-all duration-200 shadow-lg shrink-0 flex items-center justify-center">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
}
