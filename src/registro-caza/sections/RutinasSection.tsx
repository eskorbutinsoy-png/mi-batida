import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Edit2, Trash2, Check, ArrowLeft, User, Clock, CalendarCheck, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { rutinasDB, listPerreraMiembros, rutinaSemanas } from '../lib/supabaseHogar';
import type { Rutina, MiembroHogar, RutinaSemana } from '../lib/types';

const DIAS = [
  { key: 'lun', label: 'L' },
  { key: 'mar', label: 'M' },
  { key: 'mie', label: 'X' },
  { key: 'jue', label: 'J' },
  { key: 'vie', label: 'V' },
  { key: 'sab', label: 'S' },
  { key: 'dom', label: 'D' },
];

const SEMANAS_OPCIONES = [4, 8, 12, 24, 52];

const EMPTY_FORM = {
  titulo: '',
  descripcion: '',
  hora: '',
  dias: [] as string[],
  miembro_id: '',
};

function lunes(fecha: string): Date {
  const d = new Date(fecha + 'T00:00:00');
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d;
}

function fmtSemana(fechaLunes: string): string {
  const d = new Date(fechaLunes + 'T00:00:00');
  const fin = new Date(d);
  fin.setDate(d.getDate() + 6);
  return `${d.getDate()} - ${fin.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`;
}

export default function RutinasSection({ perreraId }: { perreraId: string }) {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [miembros, setMiembros] = useState<MiembroHogar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'form' | 'semanas'>('list');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<Rutina | null>(null);
  const [saving, setSaving] = useState(false);
  const [rutinaActiva, setRutinaActiva] = useState<Rutina | null>(null);
  const [semanas, setSemanas] = useState<RutinaSemana[]>([]);
  const [semanasProg, setSemanasProg] = useState(8);
  const [programando, setProgramando] = useState(false);
  const [expandedRutina, setExpandedRutina] = useState<string | null>(null);
  const [semanasMap, setSemanasMap] = useState<Record<string, RutinaSemana[]>>({});

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [r, m] = await Promise.all([rutinasDB.list(perreraId), listPerreraMiembros(perreraId)]);
      setRutinas(r);
      setMiembros(m);
    } catch {
      setError('Error al cargar las rutinas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [perreraId]);

  const loadSemanas = async (rutina_id: string) => {
    try {
      const data = await rutinaSemanas.listByRutina(rutina_id);
      setSemanasMap(prev => ({ ...prev, [rutina_id]: data }));
      return data;
    } catch {
      return [];
    }
  };

  const toggleExpanded = async (rutina_id: string) => {
    if (expandedRutina === rutina_id) {
      setExpandedRutina(null);
    } else {
      setExpandedRutina(rutina_id);
      if (!semanasMap[rutina_id]) await loadSemanas(rutina_id);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setView('form');
  };

  const openEdit = (r: Rutina) => {
    setEditing(r);
    setForm({
      titulo: r.titulo,
      descripcion: r.descripcion,
      hora: r.hora,
      dias: r.dias_semana ? r.dias_semana.split(',').filter(Boolean) : [],
      miembro_id: r.miembro_id ?? '',
    });
    setView('form');
  };

  const toggleDia = (dia: string) => {
    setForm(f => ({
      ...f,
      dias: f.dias.includes(dia) ? f.dias.filter(d => d !== dia) : [...f.dias, dia],
    }));
  };

  const save = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        hora: form.hora,
        dias_semana: form.dias.join(','),
        miembro_id: form.miembro_id || null,
      };
      if (editing) {
        await rutinasDB.update(editing.id, payload);
      } else {
        await rutinasDB.insert(perreraId, payload);
      }
      await load();
      setView('list');
    } catch {
      setError('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const deleteRutina = async (id: string) => {
    if (!confirm('¿Eliminar esta rutina y todas sus semanas programadas?')) return;
    try {
      await rutinasDB.delete(id);
      setRutinas(prev => prev.filter(r => r.id !== id));
    } catch {
      setError('Error al eliminar');
    }
  };

  const programar = async (rutina: Rutina) => {
    setProgramando(true);
    try {
      await rutinaSemanas.programar(perreraId, rutina.id, semanasProg);
      const data = await loadSemanas(rutina.id);
      setSemanas(data);
      setRutinaActiva(rutina);
      setView('semanas');
    } catch {
      setError('Error al programar');
    } finally {
      setProgramando(false);
    }
  };

  const toggleSemana = async (s: RutinaSemana) => {
    try {
      await rutinaSemanas.toggleCompletada(s.id, !s.completada);
      setSemanas(prev => prev.map(x => x.id === s.id ? { ...x, completada: !x.completada } : x));
      setSemanasMap(prev => ({
        ...prev,
        [s.rutina_id]: (prev[s.rutina_id] ?? []).map(x => x.id === s.id ? { ...x, completada: !x.completada } : x),
      }));
    } catch {
      setError('Error al actualizar');
    }
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";
  const hoy = new Date().toISOString().split('T')[0];
  const luneshoy = lunes(hoy).toISOString().split('T')[0];

  // --- SEMANAS VIEW ---
  if (view === 'semanas' && rutinaActiva) {
    const completadas = semanas.filter(s => s.completada).length;
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
          <div>
            <h2 className="text-amber-300 font-bold text-lg">{rutinaActiva.titulo}</h2>
            <p className="text-amber-700 text-xs">{semanas.length} semanas · {completadas} completadas</p>
          </div>
        </div>
        <div className="space-y-2">
          {semanas.map(s => {
            const esCurrent = s.fecha_lunes === luneshoy;
            const esPasada = s.fecha_lunes < luneshoy;
            return (
              <div
                key={s.id}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                  s.completada ? 'bg-green-900/10 border-green-700/20 opacity-70' :
                  esCurrent ? 'bg-amber-900/20 border-amber-600/40' :
                  esPasada ? 'bg-black/20 border-amber-700/10 opacity-60' :
                  'bg-black/20 border-amber-700/20'
                }`}
              >
                <button onClick={() => toggleSemana(s)} className={`flex-shrink-0 ${s.completada ? 'text-green-500' : 'text-amber-700 hover:text-amber-400'}`}>
                  {s.completada ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                <div className="flex-1">
                  <p className="text-amber-200 text-sm font-medium">
                    Semana del {fmtSemana(s.fecha_lunes)}
                    {esCurrent && <span className="ml-2 text-xs bg-amber-700/50 text-amber-200 px-1.5 py-0.5 rounded-full">Esta semana</span>}
                  </p>
                  {esPasada && !s.completada && <p className="text-red-400 text-xs">Sin completar</p>}
                </div>
                {s.completada && <Check size={14} className="text-green-400 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- FORM ---
  if (view === 'form') return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">{editing ? 'Editar Rutina' : 'Nueva Rutina'}</h2>
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
        <label className="text-amber-600 text-xs mb-2 block">Dias de la semana</label>
        <div className="flex gap-2">
          {DIAS.map(d => (
            <button
              key={d.key}
              type="button"
              onClick={() => toggleDia(d.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                form.dias.includes(d.key)
                  ? 'bg-amber-700 border-amber-500 text-white'
                  : 'bg-black/20 border-amber-700/20 text-amber-600'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-1 block">Hora (opcional)</label>
        <input type="time" className={inputCls} value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
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
                !form.miembro_id ? 'bg-amber-700/60 border-amber-500 text-amber-100' : 'bg-black/20 border-amber-700/20 text-amber-600'
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

  // --- LIST ---
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Rutinas</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Nueva
        </button>
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
      ) : rutinas.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <RefreshCw size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay rutinas registradas.</p>
          <p className="text-xs mt-1 opacity-60">Crea rutinas recurrentes y programa semanas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rutinas.map(r => {
            const miembro = r.miembro ?? miembros.find(m => m.id === r.miembro_id) ?? null;
            const dias = r.dias_semana ? r.dias_semana.split(',').filter(Boolean) : [];
            const isExpanded = expandedRutina === r.id;
            const semsRutina = semanasMap[r.id] ?? [];
            const proxima = semsRutina.find(s => !s.completada && s.fecha_lunes >= luneshoy);

            return (
              <div key={r.id} className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-amber-200 font-semibold text-sm">{r.titulo}</p>
                      {r.descripcion && <p className="text-amber-700 text-xs mt-0.5 line-clamp-1">{r.descripcion}</p>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {dias.length > 0 && (
                          <div className="flex gap-1">
                            {DIAS.map(d => (
                              <span
                                key={d.key}
                                className={`w-5 h-5 rounded text-xs flex items-center justify-center font-bold ${
                                  dias.includes(d.key)
                                    ? 'bg-amber-700/60 text-amber-200'
                                    : 'bg-black/20 text-amber-800'
                                }`}
                              >
                                {d.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.hora && (
                          <span className="text-amber-700 text-xs flex items-center gap-0.5">
                            <Clock size={10} /> {r.hora}
                          </span>
                        )}
                        {miembro && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 font-medium"
                            style={{ backgroundColor: miembro.color + '25', color: miembro.color, border: `1px solid ${miembro.color}50` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: miembro.color }} />
                            {miembro.nombre}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-amber-700 hover:text-amber-400 transition-colors"><Edit2 size={13} /></button>
                      <button onClick={() => deleteRutina(r.id)} className="p-1.5 text-red-800 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {/* Programar */}
                  <div className="mt-3 pt-3 border-t border-amber-700/10 flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2">
                      <select
                        value={semanasProg}
                        onChange={e => setSemanasProg(Number(e.target.value))}
                        className="bg-black/40 border border-amber-700/30 text-amber-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                      >
                        {SEMANAS_OPCIONES.map(n => (
                          <option key={n} value={n}>{n} semanas</option>
                        ))}
                      </select>
                      <button
                        onClick={() => programar(r)}
                        disabled={programando}
                        className="flex items-center gap-1.5 bg-green-900/40 hover:bg-green-800/40 text-green-300 border border-green-700/30 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <CalendarCheck size={13} /> Programar
                      </button>
                    </div>
                    {semsRutina.length > 0 && (
                      <button
                        onClick={() => toggleExpanded(r.id)}
                        className="flex items-center gap-1 text-amber-600 hover:text-amber-400 text-xs transition-colors"
                      >
                        {semsRutina.length} sem.
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>

                  {proxima && !isExpanded && (
                    <p className="text-amber-700 text-xs mt-1.5 flex items-center gap-1">
                      <CalendarCheck size={11} /> Próxima: semana del {fmtSemana(proxima.fecha_lunes)}
                    </p>
                  )}
                </div>

                {/* Semanas expandidas */}
                {isExpanded && semsRutina.length > 0 && (
                  <div className="border-t border-amber-700/10 divide-y divide-amber-700/10">
                    {semsRutina.map(s => {
                      const esCurrent = s.fecha_lunes === luneshoy;
                      const esPasada = s.fecha_lunes < luneshoy;
                      return (
                        <div
                          key={s.id}
                          className={`px-4 py-2 flex items-center gap-2 ${
                            s.completada ? 'opacity-50' : esCurrent ? 'bg-amber-900/10' : esPasada ? 'opacity-40' : ''
                          }`}
                        >
                          <button onClick={() => toggleSemana(s)} className={`flex-shrink-0 ${s.completada ? 'text-green-500' : 'text-amber-700'}`}>
                            {s.completada ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                          <span className={`text-xs flex-1 ${esCurrent ? 'text-amber-300 font-semibold' : 'text-amber-600'}`}>
                            Semana del {fmtSemana(s.fecha_lunes)}
                            {esCurrent && ' (esta semana)'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
