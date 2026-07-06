import { useState, useEffect } from 'react';
import { Plus, Wallet, Edit2, Trash2, ArrowLeft, Check, Search, TrendingDown, ChevronDown, ChevronUp, User } from 'lucide-react';
import { gastosDB } from '../lib/db';
import { miembrosDB } from '../lib/supabaseHogar';
import type { Gasto, MiembroHogar } from '../lib/types';

interface Props {
  perreraId: string;
}

const CATEGORIAS = [
  { value: 'comida', label: 'Comida', color: 'text-green-400', bg: 'bg-green-900/20 border-green-700/40' },
  { value: 'medicamento', label: 'Medicamento', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-700/40' },
  { value: 'veterinario', label: 'Veterinario', color: 'text-red-400', bg: 'bg-red-900/20 border-red-700/40' },
  { value: 'material', label: 'Material', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/40' },
  { value: 'otro', label: 'Otro', color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-700/40' },
];

function getCat(value: string) {
  return CATEGORIAS.find(c => c.value === value) ?? CATEGORIAS[4];
}

function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EMPTY_FORM = {
  fecha: new Date().toISOString().split('T')[0],
  categoria: 'comida',
  descripcion: '',
  importe: '',
  notas: '',
  pagado_por: '',
};

export default function GastosSection({ perreraId }: Props) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [miembros, setMiembros] = useState<MiembroHogar[]>([]);
  const [, setLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'form' | 'consulta'>('list');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('');

  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);
  const [consultaData, setConsultaData] = useState<Gasto[] | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    const loadMiembros = async () => {
      try {
        const data = await miembrosDB.list(perreraId);
        setMiembros(data);
      } catch { /* ignore */ }
    };
    loadMiembros();
  }, [perreraId]);

  useEffect(() => {
    const load = async () => {
      const data = await gastosDB.list(perreraId);
      setGastos(data);
      setLoaded(true);
    };
    load();
  }, [perreraId]);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setView('form'); };
  const openEdit = (g: Gasto) => {
    setEditing(g);
    setForm({
      fecha: g.fecha, categoria: g.categoria, descripcion: g.descripcion,
      importe: g.importe.toString(), notas: g.notas, pagado_por: g.pagado_por ?? '',
    });
    setView('form');
  };

  const save = async () => {
    if (!form.descripcion.trim() || !form.importe) return;
    setSaving(true);
    const payload = {
      fecha: form.fecha, categoria: form.categoria,
      descripcion: form.descripcion.trim(),
      importe: parseFloat(form.importe),
      notas: form.notas.trim(),
      pagado_por: form.pagado_por,
    };
    if (editing) {
      await gastosDB.update(editing.id, payload);
    } else {
      await gastosDB.insert(perreraId, payload);
    }
    const data = await gastosDB.list(perreraId);
    setGastos(data);
    setSaving(false);
    setView('list');
  };

  const deleteGasto = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await gastosDB.delete(id);
    const data = await gastosDB.list(perreraId);
    setGastos(data);
  };

  const consultar = async () => {
    setConsultando(true);
    const data = await gastosDB.list(perreraId);
    const filtered = data.filter(g => g.fecha >= fechaDesde && g.fecha <= fechaHasta);
    setConsultaData(filtered);
    setConsultando(false);
    setExpandedCat(null);
    setExpandedUser(null);
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";
  const filtered = gastos.filter(g => !filterCat || g.categoria === filterCat);
  const totalFiltrado = filtered.reduce((s, g) => s + g.importe, 0);

  // --- FORMULARIO ---
  if (view === 'form') return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">{editing ? 'Editar Gasto' : 'Nuevo Gasto'}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Fecha</label>
          <input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
        </div>
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Importe (€)</label>
          <input
            type="number" min="0" step="0.01" className={inputCls}
            placeholder="0.00" value={form.importe}
            onChange={e => setForm(f => ({ ...f, importe: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-2 block">Pagado por</label>
        {miembros.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, pagado_por: '' }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                !form.pagado_por
                  ? 'bg-amber-700/60 border-amber-500 text-amber-100'
                  : 'bg-black/20 border-amber-700/20 text-amber-600'
              }`}
            >
              Sin asignar
            </button>
            {miembros.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, pagado_por: m.nombre }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  form.pagado_por === m.nombre
                    ? 'border-current scale-105 shadow-lg text-white'
                    : 'bg-black/20 border-amber-700/20 text-amber-500'
                }`}
                style={form.pagado_por === m.nombre ? { backgroundColor: m.color + '40', borderColor: m.color, color: m.color } : {}}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                {m.nombre}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-amber-700 text-xs italic">Añade miembros en la sección Hogar para asignar</p>
        )}
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-2 block">Categoría</label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIAS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, categoria: c.value }))}
              className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                form.categoria === c.value
                  ? `${c.bg} ${c.color} border-current scale-105 shadow-lg`
                  : 'bg-black/20 border-amber-700/20 text-amber-600 hover:border-amber-600/40'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-1 block">Descripción *</label>
        <input className={inputCls} placeholder="Ej: Pienso Royal Canin 15kg" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
      </div>

      <textarea className={inputCls} rows={3} placeholder="Notas (opcional)" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />

      <button
        onClick={save}
        disabled={saving || !form.descripcion.trim() || !form.importe}
        className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Check size={18} /> {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );

  // --- CONSULTA ---
  if (view === 'consulta') {
    const totalConsulta = consultaData?.reduce((s, g) => s + g.importe, 0) ?? 0;

    const byCategoria: Record<string, Gasto[]> = {};
    consultaData?.forEach(g => {
      if (!byCategoria[g.categoria]) byCategoria[g.categoria] = [];
      byCategoria[g.categoria].push(g);
    });

    // Desglose por persona
    const byPersona: Record<string, Gasto[]> = {};
    consultaData?.forEach(g => {
      const key = g.pagado_por?.trim() || 'Sin asignar';
      if (!byPersona[key]) byPersona[key] = [];
      byPersona[key].push(g);
    });

    const personas = Object.keys(byPersona).sort((a, b) => {
      if (a === 'Sin asignar') return 1;
      if (b === 'Sin asignar') return -1;
      return byPersona[b].reduce((s, g) => s + g.importe, 0) - byPersona[a].reduce((s, g) => s + g.importe, 0);
    });

    const getMiembroColor = (nombre: string) =>
      miembros.find(m => m.nombre === nombre)?.color ?? '#d97706';

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setConsultaData(null); }} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
          <h2 className="text-amber-300 font-bold text-lg">Consulta de Gastos</h2>
        </div>

        <div className="bg-black/30 border border-amber-700/20 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-amber-600 text-xs mb-1 block">Desde</label>
              <input type="date" className={inputCls} value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
            </div>
            <div>
              <label className="text-amber-600 text-xs mb-1 block">Hasta</label>
              <input type="date" className={inputCls} value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
            </div>
          </div>
          <button
            onClick={consultar}
            disabled={consultando}
            className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Search size={16} /> {consultando ? 'Consultando...' : 'Consultar'}
          </button>
        </div>

        {consultaData !== null && (
          <>
            <div className="bg-gradient-to-br from-amber-900/40 to-black/40 border border-amber-600/30 rounded-2xl p-5 text-center">
              <p className="text-amber-600 text-xs uppercase tracking-widest mb-1">Total gastado</p>
              <p className="text-amber-200 text-4xl font-bold">{fmt(totalConsulta)} €</p>
              <p className="text-amber-700 text-xs mt-1">{consultaData.length} registro{consultaData.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Desglose por persona */}
            {personas.length > 0 && (
              <div className="space-y-2">
                <p className="text-amber-600 text-xs uppercase tracking-wider px-1 flex items-center gap-1.5">
                  <User size={12} /> Por persona
                </p>
                {personas.map(persona => {
                  const items = byPersona[persona];
                  const total = items.reduce((s, g) => s + g.importe, 0);
                  const pct = totalConsulta > 0 ? (total / totalConsulta) * 100 : 0;
                  const color = persona === 'Sin asignar' ? '#78716c' : getMiembroColor(persona);
                  const isOpen = expandedUser === persona;
                  return (
                    <div key={persona} className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
                      <button
                        className="w-full px-4 py-3 flex items-center gap-3 text-left"
                        onClick={() => setExpandedUser(isOpen ? null : persona)}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-amber-200">{persona}</span>
                            <span className="text-amber-200 font-bold text-sm">{fmt(total)} €</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-black/30 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color + 'aa' }} />
                            </div>
                            <span className="text-amber-700 text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        {isOpen ? <ChevronUp size={14} className="text-amber-600 flex-shrink-0" /> : <ChevronDown size={14} className="text-amber-600 flex-shrink-0" />}
                      </button>
                      {isOpen && (
                        <div className="border-t border-amber-700/10 divide-y divide-amber-700/10">
                          {items.map(g => (
                            <div key={g.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-amber-200 text-sm truncate">{g.descripcion}</p>
                                <p className="text-amber-700 text-xs">{new Date(g.fecha).toLocaleDateString('es-ES')} · {getCat(g.categoria).label}{g.notas ? ` · ${g.notas}` : ''}</p>
                              </div>
                              <span className="text-amber-300 font-semibold text-sm flex-shrink-0">{fmt(g.importe)} €</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Por categoría */}
            {Object.keys(byCategoria).length > 0 && (
              <div className="space-y-2">
                <p className="text-amber-600 text-xs uppercase tracking-wider px-1">Por categoría</p>
                {CATEGORIAS.filter(c => byCategoria[c.value]).map(c => {
                  const items = byCategoria[c.value];
                  const total = items.reduce((s, g) => s + g.importe, 0);
                  const pct = totalConsulta > 0 ? (total / totalConsulta) * 100 : 0;
                  const isOpen = expandedCat === c.value;
                  return (
                    <div key={c.value} className={`bg-black/30 border rounded-xl overflow-hidden ${c.bg}`}>
                      <button
                        className="w-full px-4 py-3 flex items-center gap-3 text-left"
                        onClick={() => setExpandedCat(isOpen ? null : c.value)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-semibold text-sm ${c.color}`}>{c.label}</span>
                            <span className="text-amber-200 font-bold text-sm">{fmt(total)} €</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-black/30 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-amber-700 text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        {isOpen ? <ChevronUp size={14} className="text-amber-600 flex-shrink-0" /> : <ChevronDown size={14} className="text-amber-600 flex-shrink-0" />}
                      </button>
                      {isOpen && (
                        <div className="border-t border-amber-700/10 divide-y divide-amber-700/10">
                          {items.map(g => (
                            <div key={g.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-amber-200 text-sm truncate">{g.descripcion}</p>
                                <p className="text-amber-700 text-xs">
                                  {new Date(g.fecha).toLocaleDateString('es-ES')}
                                  {g.pagado_por ? ` · ${g.pagado_por}` : ''}
                                  {g.notas ? ` · ${g.notas}` : ''}
                                </p>
                              </div>
                              <span className="text-amber-300 font-semibold text-sm flex-shrink-0">{fmt(g.importe)} €</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {consultaData.length === 0 && (
              <div className="text-center py-10 text-amber-700">
                <TrendingDown size={40} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin gastos en ese periodo</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // --- LISTADO ---
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Gastos</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setView('consulta'); setConsultaData(null); }}
            className="flex items-center gap-1.5 bg-green-900/40 hover:bg-green-900/60 text-green-300 border border-green-700/30 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Search size={14} /> Consultar
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={14} /> Añadir
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterCat('')}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${!filterCat ? 'bg-amber-700 text-white' : 'bg-black/30 text-amber-500 border border-amber-700/30'}`}
        >Todos</button>
        {CATEGORIAS.map(c => (
          <button
            key={c.value}
            onClick={() => setFilterCat(c.value)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterCat === c.value ? 'bg-amber-700 text-white' : 'bg-black/30 text-amber-500 border border-amber-700/30'}`}
          >{c.label}</button>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="bg-black/20 border border-amber-700/15 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-amber-600 text-sm">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}{filterCat ? ` · ${getCat(filterCat).label}` : ''}</span>
          <span className="text-amber-200 font-bold text-base">{fmt(totalFiltrado)} €</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <Wallet size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay gastos registrados.</p>
          <p className="text-xs mt-1 opacity-60">Pulsa Añadir para crear el primero</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(g => {
            const cat = getCat(g.categoria);
            const memberColor = g.pagado_por
              ? (miembros.find(m => m.nombre === g.pagado_por)?.color ?? '#d97706')
              : null;
            return (
              <div key={g.id} className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className={`flex-shrink-0 px-2 py-0.5 rounded-full border text-xs font-medium ${cat.bg} ${cat.color}`}>
                    {cat.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-amber-200 text-sm font-medium truncate">{g.descripcion}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-amber-700 text-xs">{new Date(g.fecha).toLocaleDateString('es-ES')}</span>
                      {g.pagado_por && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"
                          style={{ backgroundColor: (memberColor ?? '#d97706') + '25', color: memberColor ?? '#d97706', border: `1px solid ${(memberColor ?? '#d97706')}50` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: memberColor ?? '#d97706' }} />
                          {g.pagado_por}
                        </span>
                      )}
                      {g.notas && <span className="text-amber-700 text-xs">{g.notas}</span>}
                    </div>
                  </div>
                  <span className="text-amber-300 font-bold text-sm flex-shrink-0">{fmt(g.importe)} €</span>
                </div>
                <div className="flex border-t border-amber-700/10">
                  <button onClick={() => openEdit(g)} className="flex-1 py-2 text-amber-600 hover:text-amber-400 flex justify-center transition-colors"><Edit2 size={15} /></button>
                  <button onClick={() => deleteGasto(g.id)} className="flex-1 py-2 text-red-700 hover:text-red-400 flex justify-center transition-colors"><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
