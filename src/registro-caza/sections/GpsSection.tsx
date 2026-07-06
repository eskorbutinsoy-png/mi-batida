import { useState, useEffect } from 'react';
import { Plus, MapPin, Trash2, ArrowLeft, Check, Navigation, Copy, Share2, ExternalLink } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { gpsPuntosDB } from '../lib/db';
import type { GpsPunto } from '../lib/types';

const TIPOS = ['Punto', 'Postura', 'Rastro', 'Coche', 'Agarre', 'Disparo', 'Sangre', 'Perro perdido', 'Otro'];

const TIPO_COLORS: Record<string, string> = {
  'Punto': 'text-blue-400', 'Postura': 'text-green-400', 'Rastro': 'text-amber-400',
  'Coche': 'text-gray-400', 'Agarre': 'text-orange-400', 'Disparo': 'text-red-400',
  'Sangre': 'text-red-600', 'Perro perdido': 'text-yellow-400', 'Otro': 'text-amber-400'
};

const EMPTY_FORM = {
  nombre: '', tipo: 'Punto', latitud: '', longitud: '',
  fecha_hora: new Date().toISOString().slice(0, 16), notas: ''
};

interface Props {
  perreraId: string;
}

export default function GpsSection({ perreraId }: Props) {
  const [puntos, setPuntos] = useState<GpsPunto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await gpsPuntosDB.list(perreraId);
      setPuntos(data);
    } catch (err) {
      console.error('Error loading GPS puntos:', err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { load(); }, [perreraId]);

  const getLocation = async () => {
    setGeoError(null);
    setLocating(true);
    try {
      let status = await Geolocation.checkPermissions();

      if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
        status = await Geolocation.requestPermissions({ permissions: ['location'] });
      }

      if (status.location === 'denied') {
        setGeoError('Permiso de ubicación denegado. Ve a Ajustes > Aplicaciones > Mi Registro de Caza > Permisos > Ubicación y actívala.');
        setLocating(false);
        return;
      }

      if (status.location !== 'granted') {
        status = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (status.location !== 'granted') {
          setGeoError('Permiso de ubicación no concedido. Actívalo en los ajustes del móvil.');
          setLocating(false);
          return;
        }
      }

      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
      setForm(f => ({
        ...f,
        latitud: String(pos.coords.latitude.toFixed(6)),
        longitud: String(pos.coords.longitude.toFixed(6)),
        fecha_hora: new Date().toISOString().slice(0, 16)
      }));
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('denied') || errMsg.includes('permission') || errMsg.includes('Location permission') || errMsg.includes('NOT_AUTHORIZED')) {
        setGeoError('Permiso de ubicación denegado. Ve a Ajustes > Aplicaciones > Mi Registro de Caza > Permisos > Ubicación y actívala.');
      } else if (errMsg.includes('timeout')) {
        setGeoError('Tiempo de espera agotado. Sal al exterior e inténtalo de nuevo.');
      } else {
        setGeoError(`No se pudo obtener la ubicación. Asegúrate de tener el GPS activo. (${errMsg || 'Error desconocido'})`);
      }
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!form.latitud || !form.longitud) return;
    setSaving(true);
    try {
      await gpsPuntosDB.insert(perreraId, {
        nombre: form.nombre.trim(), tipo: form.tipo,
        latitud: parseFloat(form.latitud), longitud: parseFloat(form.longitud),
        fecha_hora: new Date(form.fecha_hora).toISOString(), notas: form.notas.trim()
      });
      await load();
      setView('list');
    } catch (err) {
      console.error('Error saving GPS punto:', err);
    } finally {
      setSaving(false);
    }
  };

  const deletePunto = async (id: string) => {
    if (!confirm('¿Eliminar este punto?')) return;
    try {
      await gpsPuntosDB.delete(id);
      await load();
    } catch (err) {
      console.error('Error deleting GPS punto:', err);
    }
  };

  const copyCoords = (p: GpsPunto) => {
    const txt = `${p.latitud}, ${p.longitud}`;
    navigator.clipboard?.writeText(txt);
    setCopied(p.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const openMaps = (p: GpsPunto) => {
    window.open(`https://www.google.com/maps?q=${p.latitud},${p.longitud}`, '_blank');
  };

  const shareWhatsApp = (p: GpsPunto) => {
    const msg = encodeURIComponent(`📍 ${p.nombre || p.tipo}\n${p.latitud}, ${p.longitud}\nhttps://maps.google.com?q=${p.latitud},${p.longitud}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";

  if (view === 'form') return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">Nuevo Punto GPS</h2>
      </div>

      <button onClick={getLocation} disabled={locating} className="w-full flex items-center justify-center gap-2 bg-green-800/50 hover:bg-green-700/50 border border-green-600/40 text-green-300 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
        <Navigation size={18} className={locating ? 'animate-spin' : ''} />
        {locating ? 'Obteniendo ubicación...' : 'Obtener mi ubicación GPS'}
      </button>
      {geoError && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2 text-red-300 text-xs">
          {geoError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Latitud</label>
          <input className={inputCls} placeholder="0.000000" value={form.latitud} onChange={e => setForm(f => ({ ...f, latitud: e.target.value }))} />
        </div>
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Longitud</label>
          <input className={inputCls} placeholder="0.000000" value={form.longitud} onChange={e => setForm(f => ({ ...f, longitud: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Tipo</label>
          <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Fecha/Hora</label>
          <input type="datetime-local" className={inputCls} value={form.fecha_hora} onChange={e => setForm(f => ({ ...f, fecha_hora: e.target.value }))} />
        </div>
      </div>

      <input className={inputCls} placeholder="Nombre del punto (opcional)" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
      <textarea className={inputCls} rows={2} placeholder="Notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />

      <button onClick={save} disabled={saving || !form.latitud || !form.longitud} className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
        <Check size={18} /> {saving ? 'Guardando...' : 'Guardar Punto'}
      </button>
    </div>
  );

  if (!loaded) {
    return <div className="p-8 text-center text-amber-600">Cargando...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">GPS</h2>
        <button onClick={() => { setForm({ ...EMPTY_FORM }); setView('form'); }} className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Añadir
        </button>
      </div>

      {puntos.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <MapPin size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay puntos GPS guardados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {puntos.map(p => (
            <div key={p.id} className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${TIPO_COLORS[p.tipo] || 'text-amber-400'}`}>{p.tipo}</span>
                      {p.nombre && <span className="text-amber-200 text-sm">· {p.nombre}</span>}
                    </div>
                    <div className="text-amber-600 text-xs mt-0.5 font-mono">{p.latitud}, {p.longitud}</div>
                    <div className="text-amber-700 text-xs mt-0.5">
                      {new Date(p.fecha_hora).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {p.notas && <p className="text-amber-700 text-xs mt-1">{p.notas}</p>}
                  </div>
                </div>
              </div>
              <div className="flex border-t border-amber-700/10">
                <button onClick={() => openMaps(p)} className="flex-1 py-2 text-green-600 hover:text-green-400 flex justify-center transition-colors" title="Ver en Maps"><ExternalLink size={15} /></button>
                <button onClick={() => copyCoords(p)} className="flex-1 py-2 flex justify-center transition-colors" title="Copiar">
                  {copied === p.id ? <Check size={15} className="text-green-400" /> : <Copy size={15} className="text-amber-600 hover:text-amber-400" />}
                </button>
                <button onClick={() => shareWhatsApp(p)} className="flex-1 py-2 text-green-600 hover:text-green-400 flex justify-center transition-colors" title="WhatsApp"><Share2 size={15} /></button>
                <button onClick={() => deletePunto(p.id)} className="flex-1 py-2 text-red-700 hover:text-red-400 flex justify-center transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
