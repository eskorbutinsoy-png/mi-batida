import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Batida, BatidaAlerta, AlertaPerroTipo, AlertaPerroGravedad } from '../lib/types';
import { ALERTA_PERRO_LABELS, ALERTA_PERRO_EMOJIS, ALERTA_PERRO_GRAVEDAD_LABELS, ALERTA_PERRO_GRAVEDAD_COLORS } from '../lib/types';
import { addAlertaPerro, getAlertasPerro, deleteAlertaPerro } from '../lib/db';
import { enqueueOfflineAction } from '../lib/offlineQueue';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Loader2 } from 'lucide-react';

interface Props {
  batida: Batida;
  onBack: () => void;
  isAdmin: boolean;
}

const tipos: AlertaPerroTipo[] = ['perro_cogido', 'perro_visto', 'perro_por_la_zona', 'perro_herido'];
const gravedades: AlertaPerroGravedad[] = ['leve', 'moderado', 'grave'];

function formatTimeAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function AlertaPerrosSection({ batida, onBack, isAdmin }: Props) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<AlertaPerroTipo>('perro_cogido');
  const [gravedad, setGravedad] = useState<AlertaPerroGravedad>('moderado');
  const [color, setColor] = useState('');
  const [propietario, setPropietario] = useState('');
  const [direccion, setDireccion] = useState('');
  const [raza, setRaza] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [alertas, setAlertas] = useState<BatidaAlerta[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAlertas = useCallback(async () => {
    const data = await getAlertasPerro(batida.id);
    setAlertas(data);
  }, [batida.id]);

  useEffect(() => { loadAlertas(); }, [loadAlertas]);

  useEffect(() => {
    const interval = setInterval(() => setAlertas((current) => [...current]), 60000);
    return () => clearInterval(interval);
  }, []);

  const alertasConTiempo = useMemo(() => alertas.map(a => ({ ...a, timeAgo: formatTimeAgo(a.created_at) })), [alertas]);

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleGetLocation() {
    if (!navigator.geolocation) {
      setLocationError('Geolocalización no disponible en este navegador.');
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setLocationLoading(false);
      },
      () => {
        setLocationError('No se pudo obtener la ubicación. Comprueba los permisos.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  async function handleDelete(id: string) {
    if (!user || deletingId) return;
    if (!window.confirm('¿Eliminar esta alerta?')) return;
    setDeletingId(id);
    try {
      await deleteAlertaPerro(id);
      await loadAlertas();
    } catch (err) {
      console.error('Error al borrar alerta de perro:', err);
      alert('No se pudo borrar la alerta. Revisa la consola.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || loading) return;
    if (!lat || !lng) {
      setLocationError('Debes registrar la ubicación GPS de la alerta.');
      return;
    }
    setLoading(true);
    try {
      let imagen_url: string | undefined;
      if (file) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `alertas-perros/${batida.id}/${user.id}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, file);
        if (uploadError) {
          throw new Error(uploadError.message || 'Error subiendo foto de alerta');
        }
        const { data: publicData } = supabase.storage.from('chat-images').getPublicUrl(path);
        if (!publicData?.publicUrl) {
          throw new Error('No se pudo generar URL de imagen');
        }
        imagen_url = publicData.publicUrl;
      }
      await addAlertaPerro(
        batida.id,
        user.id,
        tipo,
        color || undefined,
        propietario || undefined,
        raza || undefined,
        direccion || undefined,
        mensaje || undefined,
        imagen_url,
        Number(lat),
        Number(lng),
        tipo === 'perro_herido' ? gravedad : undefined,
      );
      setColor('');
      setPropietario('');
      setDireccion('');
      setMensaje('');
      setFile(null);
      setLat('');
      setLng('');
      setGravedad('moderado');
      loadAlertas();
    } catch (err) {
      let imageDataUrl: string | undefined;
      if (file) {
        try {
          imageDataUrl = await fileToDataUrl(file);
        } catch {
          imageDataUrl = undefined;
        }
      }

      enqueueOfflineAction({
        type: 'alerta_create',
        payload: {
          batidaId: batida.id,
          userId: user.id,
          tipo_alerta: tipo,
          color: color || undefined,
          propietario: propietario || undefined,
          raza: raza || undefined,
          direccion: direccion || undefined,
          mensaje: mensaje || undefined,
          lat: Number(lat),
          lng: Number(lng),
          gravedad: tipo === 'perro_herido' ? gravedad : undefined,
          imageDataUrl,
          imageFileName: file?.name,
        },
      });
      setColor('');
      setPropietario('');
      setDireccion('');
      setMensaje('');
      setFile(null);
      setLat('');
      setLng('');
      setGravedad('moderado');
      console.error('Error al enviar alerta de perro:', err);
      alert('Sin conexión. Alerta guardada y pendiente de envío.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onBack} className="text-amber hover:text-amber-light transition-colors p-2 -ml-2 rounded-lg hover:bg-forest-hover">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-white font-black text-xl">🚨 Alerta de perros</h2>
          <p className="text-forest-muted text-sm mt-1">Comunica perros cogidos, vistos o por la zona.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-amber/30 rounded-2xl p-5">
        <div>
          <label className="block text-sm text-amber font-black mb-3">🔍 Tipo de alerta</label>
          <div className="grid grid-cols-2 gap-2.5">
            {tipos.map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={`rounded-2xl py-3.5 text-xs font-black transition-all border-2 ${tipo === t ? 'bg-gradient-to-r from-red-600 to-red-500 border-red-400 text-white shadow-lg' : 'bg-forest border-forest-border text-white hover:border-red-500/60'}`}>
                <span className="text-base block mb-1">{ALERTA_PERRO_EMOJIS[t]}</span> {ALERTA_PERRO_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {tipo === 'perro_herido' && (
          <div>
            <label className="block text-sm text-amber font-black mb-3">🩹 Gravedad de la herida</label>
            <div className="grid grid-cols-3 gap-2.5">
              {gravedades.map(g => (
                <button key={g} type="button" onClick={() => setGravedad(g)}
                  className={`rounded-2xl py-3.5 text-xs font-black transition-all border-2 ${gravedad === g ? ALERTA_PERRO_GRAVEDAD_COLORS[g] + ' shadow-lg' : 'bg-forest border-forest-border text-white hover:border-amber/40'}`}>
                  {g === 'leve' ? '🟡' : g === 'moderado' ? '🟠' : '🔴'}
                  <span className="block mt-1">{ALERTA_PERRO_GRAVEDAD_LABELS[g]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-amber font-black mb-2">🎨 Color</label>
            <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Blanco, marrón, gris..."
              className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200" />
          </div>
          
          <div>
            <label className="block text-xs text-amber font-black mb-2">👤 ¿De quién es?</label>
            <input type="text" value={propietario} onChange={(e) => setPropietario(e.target.value)} placeholder="Nombre del dueño..."
              className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200" />
          </div>

          <div>
            <label className="block text-xs text-amber font-black mb-2">🐕 Raza</label>
            <input type="text" value={raza} onChange={(e) => setRaza(e.target.value)} placeholder="Pointer, Setter, Sabueso..."
              className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200" />
          </div>

          <div>
            <label className="block text-xs text-amber font-black mb-2">📍 Dirección</label>
            <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, pueblo, referencia..."
              className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200" />
          </div>

          <div>
            <label className="block text-xs text-amber font-black mb-2.5">🗺️ Coordenadas GPS</label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input type="text" value={lat} readOnly placeholder="Latitud"
                className="w-full bg-forest-dark/60 border-2 border-forest-border/50 rounded-xl px-3.5 py-3 text-white text-xs outline-none font-mono" />
              <input type="text" value={lng} readOnly placeholder="Longitud"
                className="w-full bg-forest-dark/60 border-2 border-forest-border/50 rounded-xl px-3.5 py-3 text-white text-xs outline-none font-mono" />
            </div>
            <button type="button" onClick={handleGetLocation}
              className="w-full bg-forest border-2 border-green-600/60 rounded-2xl py-3.5 text-sm text-green-400 hover:text-green-300 hover:border-green-500 font-black transition-all duration-200">
              {locationLoading ? '⏳ Obteniendo punto GPS...' : '📡 Capturar ubicación GPS'}
            </button>
            {locationError && <p className="text-red-400 text-xs mt-2 bg-red-900/20 border border-red-700/40 px-3 py-2 rounded-lg">⚠️ {locationError}</p>}
          </div>

          <div>
            <label className="block text-xs text-amber font-black mb-2">📝 Detalles adicionales</label>
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Comportamiento del perro, hora exacta, otras observaciones..."
              className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200 resize-none" rows={3} />
          </div>

          <div>
            <label className="block text-xs text-amber font-black mb-2">📸 Foto</label>
            <input type="file" accept="image/*" capture="environment" ref={el => fileInputRef.current = el}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full bg-forest border-2 border-amber/40 hover:border-amber rounded-2xl py-3.5 text-sm text-amber font-black transition-all duration-200">
              {file ? `✓ ${file.name}` : '📷 Tomar o seleccionar foto'}
            </button>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-black py-4 rounded-2xl transition-all duration-200 disabled:opacity-60 shadow-lg flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '🚀'}
            {loading ? 'Enviando...' : 'Enviar alerta'}
          </button>
        </div>
      </form>

      {/* Alertas list */}
      <div className="space-y-3.5">
        {alertasConTiempo.length === 0 && (
          <div className="text-center py-8">
            <p className="text-forest-light text-lg font-bold">No hay alertas</p>
            <p className="text-forest-muted text-sm mt-2">Las nuevas alertas aparecerán aquí</p>
          </div>
        )}
        {alertasConTiempo.map((alerta) => (
          <div key={alerta.id} className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-forest-border/60 rounded-2xl p-4.5">
            <div className="flex items-start gap-3.5">
              <div className="text-3xl mt-1">{ALERTA_PERRO_EMOJIS[alerta.tipo_alerta]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-white font-black text-base">{ALERTA_PERRO_LABELS[alerta.tipo_alerta]}</p>
                    <p className="text-forest-muted text-xs mt-1 font-medium">{alerta.perfil?.nombre_completo || 'Cazador'} • {alerta.timeAgo}</p>
                  </div>
                  {(alerta.user_id === user?.id || isAdmin) && (
                    <button type="button" onClick={() => handleDelete(alerta.id)}
                      disabled={deletingId === alerta.id}
                      className="text-red-400 hover:text-red-300 text-xs font-black transition-colors px-2 py-1 rounded-lg hover:bg-red-900/20">
                      {deletingId === alerta.id ? '...' : '✕'}
                    </button>
                  )}
                </div>

                {/* Alerta details grid */}
                <div className="space-y-1.5 text-sm mb-3">
                  {alerta.color && <p className="text-forest-light"><span className="text-amber font-black">Color:</span> {alerta.color}</p>}
                  {alerta.propietario && <p className="text-forest-light"><span className="text-amber font-black">Dueño:</span> {alerta.propietario}</p>}
                  {alerta.raza && <p className="text-forest-light"><span className="text-amber font-black">Raza:</span> {alerta.raza}</p>}
                  {alerta.direccion && <p className="text-forest-light"><span className="text-amber font-black">Dirección:</span> {alerta.direccion}</p>}
                  {alerta.gravedad && (
                    <p className="text-forest-light">
                      <span className="text-amber font-black">Gravedad:</span>{' '}
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black border ${ALERTA_PERRO_GRAVEDAD_COLORS[alerta.gravedad]}`}>
                        {alerta.gravedad === 'leve' ? '🟡' : alerta.gravedad === 'moderado' ? '🟠' : '🔴'} {ALERTA_PERRO_GRAVEDAD_LABELS[alerta.gravedad]}
                      </span>
                    </p>
                  )}
                  {alerta.lat != null && alerta.lng != null && (
                    <p className="text-forest-light">
                      <span className="text-amber font-black">GPS:</span>{' '}
                      <a href={`https://www.google.com/maps/search/?api=1&query=${alerta.lat},${alerta.lng}`} target="_blank" rel="noreferrer" className="text-amber hover:text-amber-light underline font-mono">
                        {alerta.lat.toFixed(4)}, {alerta.lng.toFixed(4)}
                      </a>
                    </p>
                  )}
                  {alerta.mensaje && <p className="text-forest-light mt-2 bg-forest-dark/40 border-l-2 border-amber px-3 py-2 rounded-lg">{alerta.mensaje}</p>}
                </div>

                {alerta.imagen_url && <img src={alerta.imagen_url} alt="alerta perro" className="mt-3 w-full rounded-xl object-cover border-2 border-forest-border/40" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
