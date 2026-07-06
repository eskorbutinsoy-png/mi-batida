import { useState } from 'react';
import { Plus, Dog, Edit2, Trash2, ChevronUp, ChevronDown, Camera, BookOpen, X, Check, ArrowLeft } from 'lucide-react';
import { perrosDB, perrosHistorialDB } from '../lib/db';
import type { Perro, PerroHistorial } from '../lib/types';

interface Props {
  perreraId: string;
  perros: Perro[];
  reloadPerros: () => void;
}

function calcEdad(fecha: string | null) {
  if (!fecha) return '';
  const hoy = new Date();
  const nac = new Date(fecha);
  let anos = hoy.getFullYear() - nac.getFullYear();
  let meses = hoy.getMonth() - nac.getMonth();
  let dias = hoy.getDate() - nac.getDate();
  if (dias < 0) { meses--; dias += 30; }
  if (meses < 0) { anos--; meses += 12; }
  const parts = [];
  if (anos > 0) parts.push(`${anos} año${anos > 1 ? 's' : ''}`);
  if (meses > 0) parts.push(`${meses} mes${meses > 1 ? 'es' : ''}`);
  if (anos === 0) parts.push(`${dias} día${dias > 1 ? 's' : ''}`);
  return parts.join(', ');
}

function compressImage(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 400;
        let { width, height } = img;
        if (width > height) { if (width > max) { height *= max / width; width = max; } }
        else { if (height > max) { width *= max / height; height = max; } }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const EMPTY_PERRO = {
  nombre: '', raza: '', fecha_nacimiento: '', sexo: 'macho', chip: '',
  peso: '', padre: '', madre: '', notas: '', foto: ''
};

export default function PerrosSection({ perreraId, perros, reloadPerros }: Props) {
  const [view, setView] = useState<'list' | 'form' | 'detail' | 'historial'>('list');
  const [editing, setEditing] = useState<Perro | null>(null);
  const [form, setForm] = useState({ ...EMPTY_PERRO });
  const [saving, setSaving] = useState(false);
  const [selectedPerro, setSelectedPerro] = useState<Perro | null>(null);
  const [historial, setHistorial] = useState<PerroHistorial[]>([]);
  const [histForm, setHistForm] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'nota', descripcion: '' });
  const [editingHist, setEditingHist] = useState<PerroHistorial | null>(null);
  const [zoomFoto, setZoomFoto] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_PERRO }); setView('form'); };
  const openEdit = (p: Perro) => {
    setEditing(p);
    setForm({
      nombre: p.nombre, raza: p.raza, fecha_nacimiento: p.fecha_nacimiento || '',
      sexo: p.sexo, chip: p.chip, peso: p.peso?.toString() || '',
      padre: p.padre, madre: p.madre, notas: p.notas, foto: p.foto
    });
    setView('form');
  };

  const loadHistorial = async (perroId: string) => {
    const data = await perrosHistorialDB.listByPerro(perroId);
    setHistorial(data);
  };

  const openDetail = (p: Perro) => { setSelectedPerro(p); setView('detail'); };
  const openHistorial = async (p: Perro) => {
    setSelectedPerro(p);
    await loadHistorial(p.id);
    setView('historial');
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const compressed = await compressImage(file); setForm(f => ({ ...f, foto: compressed })); }
  };

  const save = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const payload = {
      nombre: form.nombre.trim(), raza: form.raza.trim(),
      fecha_nacimiento: form.fecha_nacimiento || null,
      sexo: form.sexo, chip: form.chip.trim(),
      peso: form.peso ? parseFloat(form.peso) : null,
      padre: form.padre.trim(), madre: form.madre.trim(),
      notas: form.notas.trim(), foto: form.foto,
      orden: editing ? editing.orden : perros.length,
    };
    if (editing) {
      await perrosDB.update(editing.id, payload);
    } else {
      await perrosDB.insert(perreraId, payload);
    }
    reloadPerros();
    setSaving(false);
    setView('list');
  };

  const deletePerro = async (id: string) => {
    if (!confirm('¿Eliminar este perro?')) return;
    await perrosDB.delete(id);
    // La eliminación en cascada se maneja en la BD
    reloadPerros();
  };

  const moveOrder = async (perro: Perro, dir: 'up' | 'down') => {
    const idx = perros.findIndex(p => p.id === perro.id);
    const target = dir === 'up' ? perros[idx - 1] : perros[idx + 1];
    if (!target) return;
    await perrosDB.update(perro.id, { orden: target.orden });
    await perrosDB.update(target.id, { orden: perro.orden });
    reloadPerros();
  };

  const saveHistorial = async () => {
    if (!histForm.descripcion.trim() || !selectedPerro) return;
    if (editingHist) {
      await perrosHistorialDB.update(editingHist.id, histForm);
    } else {
      await perrosHistorialDB.insert(perreraId, { ...histForm, perro_id: selectedPerro.id });
    }
    setHistForm({ fecha: new Date().toISOString().split('T')[0], tipo: 'nota', descripcion: '' });
    setEditingHist(null);
    await loadHistorial(selectedPerro.id);
  };

  const deleteHist = async (id: string) => {
    if (!confirm('¿Eliminar?')) return;
    await perrosHistorialDB.delete(id);
    if (selectedPerro) await loadHistorial(selectedPerro.id);
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";

  if (view === 'form') return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">{editing ? 'Editar Perro' : 'Nuevo Perro'}</h2>
      </div>

      {/* Foto */}
      <div className="flex flex-col items-center gap-3">
        {form.foto ? (
          <img src={form.foto} className="w-24 h-24 rounded-full object-cover border-2 border-amber-600" alt="" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-amber-900/20 border-2 border-amber-700/40 flex items-center justify-center">
            <Dog size={32} className="text-amber-700" />
          </div>
        )}
        <div className="flex gap-2">
          <label className="flex items-center gap-2 bg-amber-700/30 hover:bg-amber-700/50 text-amber-300 rounded-lg px-4 py-2 cursor-pointer text-sm transition-colors">
            <Camera size={16} /> Cámara
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </label>
          <label className="flex items-center gap-2 bg-amber-800/30 hover:bg-amber-800/50 text-amber-300 rounded-lg px-4 py-2 cursor-pointer text-sm transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Galería
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
        </div>
      </div>

      <input className={inputCls} placeholder="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
      <input className={inputCls} placeholder="Raza" value={form.raza} onChange={e => setForm(f => ({ ...f, raza: e.target.value }))} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Fecha nacimiento</label>
          <input type="date" className={inputCls} value={form.fecha_nacimiento} onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
        </div>
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Sexo</label>
          <select className={inputCls} value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
            <option value="macho">Macho</option>
            <option value="hembra">Hembra</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Chip" value={form.chip} onChange={e => setForm(f => ({ ...f, chip: e.target.value }))} />
        <input className={inputCls} placeholder="Peso (kg)" type="number" step="0.1" value={form.peso} onChange={e => setForm(f => ({ ...f, peso: e.target.value }))} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Padre" value={form.padre} onChange={e => setForm(f => ({ ...f, padre: e.target.value }))} />
        <input className={inputCls} placeholder="Madre" value={form.madre} onChange={e => setForm(f => ({ ...f, madre: e.target.value }))} />
      </div>

      <textarea className={inputCls} rows={3} placeholder="Notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />

      <button
        onClick={save}
        disabled={saving || !form.nombre.trim()}
        className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Check size={18} /> {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );

  if (view === 'detail' && selectedPerro) return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">{selectedPerro.nombre}</h2>
      </div>
      {zoomFoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setZoomFoto(null)}>
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2" onClick={() => setZoomFoto(null)}><X size={24} /></button>
          <img src={zoomFoto} className="max-w-full max-h-full rounded-xl object-contain" alt="" />
        </div>
      )}
      <div className="flex flex-col items-center gap-3">
        {selectedPerro.foto ? (
          <img
            src={selectedPerro.foto}
            className="w-36 h-36 rounded-2xl object-cover border-2 border-amber-600 cursor-pointer active:opacity-80"
            alt=""
            onClick={() => setZoomFoto(selectedPerro.foto)}
          />
        ) : (
          <div className="w-36 h-36 rounded-2xl bg-amber-900/20 border-2 border-amber-700/40 flex items-center justify-center">
            <Dog size={48} className="text-amber-700" />
          </div>
        )}
        <span className={`text-xs px-3 py-1 rounded-full border ${selectedPerro.sexo === 'macho' ? 'border-blue-600/40 text-blue-300 bg-blue-900/20' : 'border-pink-600/40 text-pink-300 bg-pink-900/20'}`}>
          {selectedPerro.sexo === 'macho' ? '♂ Macho' : '♀ Hembra'}
        </span>
      </div>
      <div className="bg-black/30 border border-amber-700/20 rounded-xl divide-y divide-amber-700/10">
        {[
          ['Raza', selectedPerro.raza],
          ['Fecha nac.', selectedPerro.fecha_nacimiento ? new Date(selectedPerro.fecha_nacimiento).toLocaleDateString('es-ES') : '-'],
          ['Edad', calcEdad(selectedPerro.fecha_nacimiento)],
          ['Chip', selectedPerro.chip],
          ['Peso', selectedPerro.peso ? `${selectedPerro.peso} kg` : '-'],
          ['Padre', selectedPerro.padre],
          ['Madre', selectedPerro.madre],
        ].map(([label, value]) => value ? (
          <div key={label} className="flex justify-between px-4 py-2">
            <span className="text-amber-600 text-sm">{label}</span>
            <span className="text-amber-200 text-sm">{value}</span>
          </div>
        ) : null)}
      </div>
      {selectedPerro.notas && (
        <div className="bg-black/30 border border-amber-700/20 rounded-xl p-4">
          <p className="text-amber-600 text-xs mb-1">Notas</p>
          <p className="text-amber-200 text-sm">{selectedPerro.notas}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => openEdit(selectedPerro)} className="bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 rounded-xl py-3 flex items-center justify-center gap-2 text-sm">
          <Edit2 size={16} /> Editar
        </button>
        <button onClick={() => { openHistorial(selectedPerro); }} className="bg-green-900/40 hover:bg-green-900/60 text-green-300 rounded-xl py-3 flex items-center justify-center gap-2 text-sm">
          <BookOpen size={16} /> Historial
        </button>
      </div>
    </div>
  );

  if (view === 'historial' && selectedPerro) return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setView('detail')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">Historial · {selectedPerro.nombre}</h2>
      </div>

      <div className="bg-black/30 border border-amber-700/20 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className="bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-500" value={histForm.fecha} onChange={e => setHistForm(f => ({ ...f, fecha: e.target.value }))} />
          <select className="bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-500" value={histForm.tipo} onChange={e => setHistForm(f => ({ ...f, tipo: e.target.value }))}>
            <option value="nota">Nota</option>
            <option value="incidencia">Incidencia</option>
            <option value="logro">Logro</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <textarea className="w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500" rows={2} placeholder="Descripción" value={histForm.descripcion} onChange={e => setHistForm(f => ({ ...f, descripcion: e.target.value }))} />
        <div className="flex gap-2">
          <button onClick={saveHistorial} className="flex-1 bg-amber-700 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
            <Check size={14} /> {editingHist ? 'Actualizar' : 'Añadir'}
          </button>
          {editingHist && (
            <button onClick={() => { setEditingHist(null); setHistForm({ fecha: new Date().toISOString().split('T')[0], tipo: 'nota', descripcion: '' }); }} className="bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {historial.length === 0 && <p className="text-amber-700 text-sm text-center py-4">Sin historial</p>}
        {historial.map(h => (
          <div key={h.id} className="bg-black/30 border border-amber-700/20 rounded-xl px-4 py-3 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-500 text-xs font-medium capitalize">{h.tipo}</span>
                <span className="text-amber-700 text-xs">·</span>
                <span className="text-amber-700 text-xs">{new Date(h.fecha).toLocaleDateString('es-ES')}</span>
              </div>
              <p className="text-amber-200 text-sm">{h.descripcion}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => { setEditingHist(h); setHistForm({ fecha: h.fecha, tipo: h.tipo, descripcion: h.descripcion }); }} className="text-amber-600 hover:text-amber-400 p-1"><Edit2 size={14} /></button>
              <button onClick={() => deleteHist(h.id)} className="text-red-600 hover:text-red-400 p-1"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Modal foto en grande */}
      {zoomFoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setZoomFoto(null)}
        >
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2" onClick={() => setZoomFoto(null)}>
            <X size={24} />
          </button>
          <img src={zoomFoto} className="max-w-full max-h-full rounded-xl object-contain" alt="" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Mis Perros</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Añadir
        </button>
      </div>

      {perros.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <Dog size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay perros. Añade el primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {perros.map((p, idx) => (
            <div key={p.id} className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/20 transition-colors" onClick={() => openDetail(p)}>
                {p.foto ? (
                  <img
                    src={p.foto}
                    className="w-20 h-20 rounded-xl object-cover border border-amber-700/40 flex-shrink-0 active:opacity-80"
                    alt=""
                    onClick={e => { e.stopPropagation(); setZoomFoto(p.foto); }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-amber-900/20 border border-amber-700/30 flex items-center justify-center flex-shrink-0">
                    <Dog size={28} className="text-amber-700" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-amber-200 font-medium truncate">{p.nombre}</div>
                  <div className="text-amber-600 text-xs">{p.raza}{p.fecha_nacimiento ? ` · ${calcEdad(p.fecha_nacimiento)}` : ''}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${p.sexo === 'macho' ? 'border-blue-600/40 text-blue-300' : 'border-pink-600/40 text-pink-300'}`}>
                  {p.sexo === 'macho' ? '♂' : '♀'}
                </span>
              </button>
              <div className="flex border-t border-amber-700/10">
                <button onClick={() => moveOrder(p, 'up')} disabled={idx === 0} className="flex-1 py-2 text-amber-700 hover:text-amber-400 disabled:opacity-20 flex justify-center transition-colors"><ChevronUp size={16} /></button>
                <button onClick={() => moveOrder(p, 'down')} disabled={idx === perros.length - 1} className="flex-1 py-2 text-amber-700 hover:text-amber-400 disabled:opacity-20 flex justify-center transition-colors"><ChevronDown size={16} /></button>
                <button onClick={() => openEdit(p)} className="flex-1 py-2 text-amber-600 hover:text-amber-400 flex justify-center transition-colors"><Edit2 size={16} /></button>
                <button onClick={() => deletePerro(p.id)} className="flex-1 py-2 text-red-700 hover:text-red-400 flex justify-center transition-colors"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
