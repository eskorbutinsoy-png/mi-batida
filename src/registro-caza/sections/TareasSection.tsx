import { useState, useEffect } from 'react';
import { Plus, CheckSquare, Square, Edit2, Trash2, Check, ArrowLeft, User, Calendar } from 'lucide-react';
import { tareasDB, listPerreraMiembros } from '../lib/supabaseHogar';
import type { Tarea, MiembroHogar } from '../lib/types';

const EMPTY_FORM = {
  titulo: '',
  descripcion: '',
  miembro_id: '',
  fecha: '',
};

export default function TareasSection({ perreraId }: { perreraId: string }) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [miembros, setMiembros] = useState<MiembroHogar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<Tarea | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'pendientes' | 'completadas'>('pendientes');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [t, m] = await Promise.all([tareasDB.list(perreraId), listPerreraMiembros(perreraId)]);
      setTareas(t);
      setMiembros(m);
    } catch {
      setError('Error al cargar las tareas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [perreraId]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setView('form');
  };

  const openEdit = (t: Tarea) => {
    setEditing(t);
    setForm({
      titulo: t.titulo,
      descripcion: t.descripcion,
      miembro_id: t.miembro_id ?? '',
      fecha: t.fecha ?? '',
    });
    setView('form');
  };

  const save = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        miembro_id: form.miembro_id || null,
        fecha: form.fecha || null,
      };
      if (editing) {
        await tareasDB.update(editing.id, payload);
      } else {
        await tareasDB.insert(perreraId, payload);
      }
      await load();
      setView('list');
    } catch {
      setError('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleCompletada = async (t: Tarea) => {
    try {
      await tareasDB.update(t.id, { completada: !t.completada });
      setTareas(prev => prev.map(x => x.id === t.id ? { ...x, completada: !x.completada } : x));
    } catch {
      setError('Error al actualizar');
    }
  };

  const deleteTarea = async (id: string) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
      await tareasDB.delete(id);
      setTareas(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Error al eliminar');
    }
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";

  const filtered = tareas.filter(t => {
    if (filtro === 'pendientes') return !t.completada;
    if (filtro === 'completadas') return t.completada;
    return true;
  });

  const pendientes = tareas.filter(t => !t.completada).length;

  if (view === 'form') return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">{editing ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-1 block">Titulo *</label>
        <input className={inputCls} placeholder="Ej: Dar de comer a los perros" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} autoFocus />
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-1 block">Descripcion</label>
        <textarea className={inputCls} rows={2} placeholder="Detalles opcionales..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-2 block">Asignar a</label>
        {miembros.length === 0 ? (
          <p className="text-amber-700 text-xs italic">Solo tú eres miembro de la perrera por ahora</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, miembro_id: '' }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1 ${
                !form.miembro_id
                  ? 'bg-amber-700/60 border-amber-500 text-amber-100'
                  : 'bg-black/20 border-amber-700/20 text-amber-600'
              }`}
            >
              <User size={11} /> Sin asignar
            </button>
            {miembros.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, miembro_id: m.id }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  form.miembro_id === m.id ? 'scale-105 shadow-lg text-white' : 'bg-black/20 border-amber-700/20 text-amber-500'
                }`}
                style={form.miembro_id === m.id ? { backgroundColor: m.color + '40', borderColor: m.color, color: m.color } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                {m.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-1 block">Fecha limite (opcional)</label>
        <input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !form.titulo.trim()}
        className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Check size={18} /> {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-amber-300 font-bold text-lg">Tareas</h2>
          {pendientes > 0 && (
            <span className="bg-amber-700 text-white text-xs rounded-full px-2 py-0.5 font-semibold">{pendientes}</span>
          )}
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Nueva
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {(['pendientes', 'todas', 'completadas'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors capitalize ${
              filtro === f ? 'bg-amber-700 text-white' : 'bg-black/30 text-amber-600 border border-amber-700/30'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={load} className="text-red-300 text-xs underline">Reintentar</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <CheckSquare size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {filtro === 'pendientes' ? 'No hay tareas pendientes' :
             filtro === 'completadas' ? 'No hay tareas completadas' :
             'No hay tareas registradas'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const miembro = t.miembro ?? miembros.find(m => m.id === t.miembro_id) ?? null;
            return (
              <div
                key={t.id}
                className={`bg-black/30 border rounded-xl overflow-hidden transition-all ${
                  t.completada ? 'border-amber-700/10 opacity-60' : 'border-amber-700/20'
                }`}
              >
                <div className="px-3 py-3 flex items-start gap-3">
                  <button
                    onClick={() => toggleCompletada(t)}
                    className={`flex-shrink-0 mt-0.5 transition-colors ${t.completada ? 'text-green-500' : 'text-amber-700 hover:text-amber-400'}`}
                  >
                    {t.completada ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${t.completada ? 'line-through text-amber-600' : 'text-amber-200'}`}>
                      {t.titulo}
                    </p>
                    {t.descripcion && <p className="text-amber-700 text-xs mt-0.5 line-clamp-1">{t.descripcion}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {miembro ? (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 font-medium"
                          style={{ backgroundColor: miembro.color + '25', color: miembro.color, border: `1px solid ${miembro.color}50` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: miembro.color }} />
                          {miembro.nombre}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-800 flex items-center gap-1">
                          <User size={10} /> Sin asignar
                        </span>
                      )}
                      {t.fecha && (
                        <span className="text-xs text-amber-700 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(t.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(t)} className="p-1.5 text-amber-700 hover:text-amber-400 transition-colors"><Edit2 size={13} /></button>
                    <button onClick={() => deleteTarea(t.id)} className="p-1.5 text-red-800 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
