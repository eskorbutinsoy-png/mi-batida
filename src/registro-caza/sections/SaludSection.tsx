import { useState, useEffect } from 'react';
import { Plus, HeartPulse, Edit2, Trash2, ArrowLeft, Check, Bell, Camera, ImageIcon, X } from 'lucide-react';
import { saludDB } from '../lib/db';
import type { Salud, Perro } from '../lib/types';

interface Props {
  perreraId: string;
  perros: Perro[];
  reloadAlertas: () => void;
  notifVistas: Set<string>;
  onDismiss: (s: Salud) => void;
}

const TIPOS = ['antirrábica', 'vacunación', 'desparasitación', 'tratamiento', 'lesión', 'operación', 'alergia', 'otro'];

const EMPTY_FORM = {
  perro_id: '', tipo: 'vacunación', fecha: new Date().toISOString().split('T')[0],
  fecha_proximo: '', avisar_dias_antes: 7, repetir_valor: 1, repetir_unidad: 'anos', notas: '', foto: ''
};

function compressImage(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 600;
        let { width, height } = img;
        if (width > height) { if (width > max) { height *= max / width; width = max; } }
        else { if (height > max) { width *= max / height; height = max; } }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function calcProximaFecha(fechaBase: string, valor: number, unidad: string): string {
  const d = new Date(fechaBase);
  if (unidad === 'dias') d.setDate(d.getDate() + valor);
  else if (unidad === 'meses') d.setMonth(d.getMonth() + valor);
  else d.setFullYear(d.getFullYear() + valor);
  return d.toISOString().split('T')[0];
}

export default function SaludSection({ perreraId, perros, reloadAlertas, notifVistas, onDismiss }: Props) {
  const [registros, setRegistros] = useState<Salud[]>([]);
  const [, setLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<Salud | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterPerro, setFilterPerro] = useState('');

  useEffect(() => {
    const load = async () => {
      const data = await saludDB.listWithPerro(perreraId);
      const sorted = (data || []).sort((a, b) => {
        if (!a.fecha_proximo && !b.fecha_proximo) return 0;
        if (!a.fecha_proximo) return 1;
        if (!b.fecha_proximo) return -1;
        return a.fecha_proximo.localeCompare(b.fecha_proximo);
      });
      setRegistros(sorted as Salud[]);
      setLoaded(true);
    };
    load();
  }, [perreraId]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, perro_id: perros[0]?.id || '' });
    setView('form');
  };

  const openEdit = (s: Salud) => {
    setEditing(s);
    setForm({
      perro_id: s.perro_id, tipo: s.tipo, fecha: s.fecha,
      fecha_proximo: s.fecha_proximo || '', avisar_dias_antes: s.avisar_dias_antes,
      repetir_valor: s.repetir_valor, repetir_unidad: s.repetir_unidad, notas: s.notas,
      foto: s.foto || ''
    });
    setView('form');
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const compressed = await compressImage(file); setForm(f => ({ ...f, foto: compressed })); }
  };

  const handleFechaChange = (fecha: string) => {
    const proximo = calcProximaFecha(fecha, form.repetir_valor, form.repetir_unidad);
    setForm(f => ({ ...f, fecha, fecha_proximo: proximo }));
  };

  const handleRepetirChange = (valor: number, unidad: string) => {
    const proximo = form.fecha ? calcProximaFecha(form.fecha, valor, unidad) : '';
    setForm(f => ({ ...f, repetir_valor: valor, repetir_unidad: unidad, fecha_proximo: proximo }));
  };

  const save = async () => {
    if (!form.perro_id || !form.fecha) return;
    setSaving(true);
    const payload = {
      perro_id: form.perro_id, tipo: form.tipo, fecha: form.fecha,
      fecha_proximo: form.fecha_proximo || null,
      avisar_dias_antes: form.avisar_dias_antes,
      repetir_valor: form.repetir_valor, repetir_unidad: form.repetir_unidad,
      notas: form.notas.trim(), foto: form.foto
    };
    if (editing) {
      await saludDB.update(editing.id, payload);
    } else {
      await saludDB.insert(perreraId, payload);
    }
    const data = await saludDB.listWithPerro(perreraId);
    const sorted = (data || []).sort((a, b) => {
      if (!a.fecha_proximo && !b.fecha_proximo) return 0;
      if (!a.fecha_proximo) return 1;
      if (!b.fecha_proximo) return -1;
      return a.fecha_proximo.localeCompare(b.fecha_proximo);
    });
    setRegistros(sorted as Salud[]);
    reloadAlertas();
    setSaving(false);
    setView('list');
  };

  const deleteReg = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    await saludDB.delete(id);
    const data = await saludDB.listWithPerro(perreraId);
    const sorted = (data || []).sort((a, b) => {
      if (!a.fecha_proximo && !b.fecha_proximo) return 0;
      if (!a.fecha_proximo) return 1;
      if (!b.fecha_proximo) return -1;
      return a.fecha_proximo.localeCompare(b.fecha_proximo);
    });
    setRegistros(sorted as Salud[]);
    reloadAlertas();
  };

  const hoy = new Date();
  const getDiffDias = (fecha: string | null) => {
    if (!fecha) return null;
    return Math.ceil((new Date(fecha).getTime() - hoy.getTime()) / 86400000);
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";
  const filtered = registros.filter(r => !filterPerro || r.perro_id === filterPerro);

  if (view === 'form') return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">{editing ? 'Editar Tratamiento' : 'Nuevo Tratamiento'}</h2>
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-1 block">Perro</label>
        <select className={inputCls} value={form.perro_id} onChange={e => setForm(f => ({ ...f, perro_id: e.target.value }))}>
          <option value="">Seleccionar perro...</option>
          {perros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Tipo</label>
          <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            {TIPOS.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Fecha</label>
          <input type="date" className={inputCls} value={form.fecha} onChange={e => handleFechaChange(e.target.value)} />
        </div>
      </div>

      <div className="bg-black/20 border border-amber-700/20 rounded-xl p-3 space-y-3">
        <p className="text-amber-400 text-xs font-medium">Repetir en</p>
        <div className="flex gap-2">
          <input type="number" min="1" className="w-20 bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-500" value={form.repetir_valor} onChange={e => handleRepetirChange(parseInt(e.target.value) || 1, form.repetir_unidad)} />
          <select className="flex-1 bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm focus:outline-none" value={form.repetir_unidad} onChange={e => handleRepetirChange(form.repetir_valor, e.target.value)}>
            <option value="dias">Días</option>
            <option value="meses">Meses</option>
            <option value="anos">Años</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-amber-600 text-xs mb-1 block">Próxima fecha</label>
            <input type="date" className={inputCls} value={form.fecha_proximo} onChange={e => setForm(f => ({ ...f, fecha_proximo: e.target.value }))} />
          </div>
          <div>
            <label className="text-amber-600 text-xs mb-1 block">Avisar X días antes</label>
            <input type="number" min="0" className={inputCls} value={form.avisar_dias_antes} onChange={e => setForm(f => ({ ...f, avisar_dias_antes: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
      </div>

      <textarea className={inputCls} rows={3} placeholder="Notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />

      {/* Foto del medicamento */}
      <div className="space-y-2">
        <label className="text-amber-600 text-xs block">Foto del medicamento (opcional)</label>
        {form.foto && (
          <div className="relative inline-block">
            <img src={form.foto} className="w-full max-h-40 object-contain rounded-xl border border-amber-700/40 bg-black/20" alt="Medicamento" />
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, foto: '' }))}
              className="absolute top-2 right-2 bg-red-700/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
            >✕</button>
          </div>
        )}
        <div className="flex gap-2">
          <label className="flex-1 flex items-center justify-center gap-2 bg-amber-700/30 hover:bg-amber-700/50 text-amber-300 rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors">
            <Camera size={15} /> Cámara
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </label>
          <label className="flex-1 flex items-center justify-center gap-2 bg-amber-800/30 hover:bg-amber-800/50 text-amber-300 rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors">
            <ImageIcon size={15} /> Galería
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
        </div>
      </div>

      <button onClick={save} disabled={saving || !form.perro_id} className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
        <Check size={18} /> {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );

  const alertasPendientes = filtered.filter(s => {
    const diff = getDiffDias(s.fecha_proximo);
    const esAlerta = diff !== null && diff <= (s.avisar_dias_antes ?? 7);
    return esAlerta && !notifVistas.has(`${s.id}_${s.fecha_proximo}`);
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Salud</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Añadir
        </button>
      </div>

      {alertasPendientes.length > 0 && (
        <div className="bg-red-900/30 border border-red-600/40 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={14} className="text-red-400 animate-pulse" />
            <span className="text-red-300 text-xs font-semibold">{alertasPendientes.length} aviso{alertasPendientes.length > 1 ? 's' : ''} pendiente{alertasPendientes.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-1.5">
            {alertasPendientes.map(s => {
              const diff = getDiffDias(s.fecha_proximo);
              return (
                <div key={s.id} className="flex items-center gap-2 bg-red-950/50 rounded-lg px-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-red-200 text-xs font-medium">{(s as any).perro?.nombre}</span>
                    <span className="text-red-500 text-xs"> · {s.tipo}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    diff !== null && diff < 0 ? 'bg-red-700 text-white' : diff === 0 ? 'bg-orange-600 text-white' : 'bg-yellow-700/60 text-yellow-200'
                  }`}>
                    {diff !== null && diff < 0 ? `${Math.abs(diff)}d venc.` : diff === 0 ? 'Hoy' : `${diff}d`}
                  </span>
                  <button
                    onClick={() => onDismiss(s)}
                    className="flex-shrink-0 text-red-600 hover:text-red-300 p-1 rounded-full hover:bg-red-900/40 transition-colors"
                    title="Marcar como visto"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {perros.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilterPerro('')} className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${!filterPerro ? 'bg-amber-700 text-white' : 'bg-black/30 text-amber-500 border border-amber-700/30'}`}>Todos</button>
          {perros.map(p => (
            <button key={p.id} onClick={() => setFilterPerro(p.id)} className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterPerro === p.id ? 'bg-amber-700 text-white' : 'bg-black/30 text-amber-500 border border-amber-700/30'}`}>{p.nombre}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <HeartPulse size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay registros de salud.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const diff = getDiffDias(s.fecha_proximo);
            const vencido = diff !== null && diff < 0;
            const urgente = diff !== null && diff >= 0 && diff <= (s.avisar_dias_antes || 7);
            return (
              <div key={s.id} className={`bg-black/30 border rounded-xl overflow-hidden ${vencido ? 'border-red-600/50' : urgente ? 'border-yellow-600/50' : 'border-amber-700/20'}`}>
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-amber-300 font-medium text-sm capitalize">{s.tipo}</span>
                        {(urgente || vencido) && <Bell size={12} className={`${vencido ? 'text-red-400' : 'text-yellow-400'} animate-pulse`} />}
                      </div>
                      <div className="text-amber-600 text-xs mt-0.5">{(s as any).perro?.nombre}</div>
                      <div className="text-amber-700 text-xs mt-1">
                        Fecha: {new Date(s.fecha).toLocaleDateString('es-ES')}
                        {s.fecha_proximo && (
                          <span className={`ml-2 ${vencido ? 'text-red-400' : urgente ? 'text-yellow-400' : 'text-amber-600'}`}>
                            · Próx: {new Date(s.fecha_proximo).toLocaleDateString('es-ES')}
                            {diff !== null && (
                              <span> ({vencido ? `${Math.abs(diff)}d vencido` : diff === 0 ? 'hoy' : `${diff}d`})</span>
                            )}
                          </span>
                        )}
                      </div>
                      {s.notas && <p className="text-amber-700 text-xs mt-1 truncate">{s.notas}</p>}
                    </div>
                    {s.foto && (
                      <img src={s.foto} className="w-14 h-14 object-contain rounded-lg border border-amber-700/30 bg-black/20 flex-shrink-0 ml-2" alt="Med." />
                    )}
                  </div>
                </div>
                <div className="flex border-t border-amber-700/10">
                  <button onClick={() => openEdit(s)} className="flex-1 py-2 text-amber-600 hover:text-amber-400 flex justify-center"><Edit2 size={15} /></button>
                  <button onClick={() => deleteReg(s.id)} className="flex-1 py-2 text-red-700 hover:text-red-400 flex justify-center"><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
