import { useState, useEffect } from 'react';
import { Plus, Minus, Crosshair, Edit2, Trash2, ArrowLeft, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { caceriasDB, caceriaAnimalesDB, caceriaPerrosDB, caceriaPerroEspeciesDB, perrosDB } from '../lib/db';
import type { Caceria, CaceriaAnimal, CaceriaPerro, CaceriaPerroEspecie, CaceriaPerroEspecies, Perro } from '../lib/types';

interface Props {
  perreraId: string;
  perros: Perro[];
}

const ESPECIES = ['Conejo', 'Liebre', 'Perdiz', 'Paloma', 'Codorniz', 'Jabalí', 'Ciervo', 'Corzo', 'Zorro', 'Becada', 'Otro'];
const MODALIDADES = ['Montería', 'Batida', 'Ojeo', 'En mano', 'Aguardo', 'Cetrería', 'Otra'];
const TODOS_CONTADORES: { field: keyof CaceriaPerroEspecies; label: string }[] = [
  { field: 'muertes', label: 'Muertes' },
  { field: 'levantados', label: 'Levantados' },
  { field: 'perseguidos', label: 'Perseguidos' },
  { field: 'perdidos', label: 'Perdidos' },
  { field: 'cobradas', label: 'Cobradas' },
  { field: 'amuestra', label: 'A muestra' },
];

const EMPTY_FORM = { fecha: new Date().toISOString().split('T')[0], lugar: '', modalidad: '', notas: '' };
const EMPTY_ESPECIES: CaceriaPerroEspecies = { levantados: [], perseguidos: [], perdidos: [], muertes: [], cobradas: [], amuestra: [] };

function totalEspecies(list: CaceriaPerroEspecie[]) {
  return list.reduce((s, e) => s + e.cantidad, 0);
}

// Sub-panel desplegable para un campo de perro (muertes, perseguidos, etc.)
interface CampoEspeciesProps {
  label: string;
  especies: CaceriaPerroEspecie[];
  onChange: (especies: CaceriaPerroEspecie[]) => void;
  hideHeader?: boolean;
}

function CampoEspeciesPanel({ label, especies, onChange, hideHeader }: CampoEspeciesProps) {
  const [open, setOpen] = useState(false);
  const [nuevaEspecie, setNuevaEspecie] = useState(ESPECIES[0]);
  const total = totalEspecies(especies);

  const addEspecie = () => {
    if (especies.find(e => e.especie === nuevaEspecie)) return;
    onChange([...especies, { especie: nuevaEspecie, cantidad: 0 }]);
  };

  const setAmount = (idx: number, delta: number) => {
    onChange(especies.map((e, i) => i === idx ? { ...e, cantidad: Math.max(0, e.cantidad + delta) } : e));
  };

  const removeEspecie = (idx: number) => onChange(especies.filter((_, i) => i !== idx));

  const bodyContent = (
    <div className="px-3 pb-3 space-y-2 pt-2">
      <div className="flex gap-2">
        <select
          className="flex-1 bg-black/40 border border-amber-700/40 rounded-lg px-2 py-1.5 text-amber-100 text-sm focus:outline-none"
          value={nuevaEspecie}
          onChange={e => setNuevaEspecie(e.target.value)}
        >
          {ESPECIES.map(esp => <option key={esp} value={esp}>{esp}</option>)}
        </select>
        <button
          type="button"
          onClick={addEspecie}
          className="bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg"
        >
          <Plus size={14} />
        </button>
      </div>

      {especies.map((e, idx) => (
        <div key={e.especie} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-1.5">
          <span className="text-amber-200 text-sm">{e.especie}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAmount(idx, -1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-black/40 text-amber-400 hover:text-amber-200"><Minus size={13} /></button>
            <span className="text-amber-100 font-bold w-6 text-center text-sm">{e.cantidad}</span>
            <button type="button" onClick={() => setAmount(idx, 1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-amber-700/60 text-amber-200 hover:bg-amber-600"><Plus size={13} /></button>
            <button type="button" onClick={() => removeEspecie(idx)} className="text-red-700 hover:text-red-400 ml-1"><Trash2 size={13} /></button>
          </div>
        </div>
      ))}

      {especies.length === 0 && (
        <p className="text-amber-800 text-xs text-center py-1">Añade una especie</p>
      )}
    </div>
  );

  if (hideHeader) {
    return <div className="border-t border-amber-700/10">{bodyContent}</div>;
  }

  return (
    <div className="bg-black/30 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2"
      >
        <span className="text-amber-300 text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="bg-amber-700/60 text-amber-200 text-xs px-2 py-0.5 rounded-full">{total}</span>
          )}
          {open ? <ChevronUp size={15} className="text-amber-600" /> : <ChevronDown size={15} className="text-amber-600" />}
        </div>
      </button>
      {open && <div className="border-t border-amber-700/10">{bodyContent}</div>}
    </div>
  );
}

// Estado local por perro en el formulario
interface PerroFormState {
  especies: CaceriaPerroEspecies;
  duracion_minutos: number;
}

export default function CaceriasSection({ perreraId, perros }: Props) {
  const [cacerias, setCacerias] = useState<Caceria[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<Caceria | null>(null);
  const [selected, setSelected] = useState<Caceria | null>(null);
  const [animales, setAnimales] = useState<CaceriaAnimal[]>([]);
  // Map perroId -> estado del formulario
  const [perrosParticIds, setPerrosParticIds] = useState<string[]>([]);
  const [perrosFormState, setPerrosFormState] = useState<Record<string, PerroFormState>>({});
  const [nuevaEspecie, setNuevaEspecie] = useState('Conejo');
  // contadores activos por perro: perroId -> array de campos activos
  const [perrosContadores, setPerrosContadores] = useState<Record<string, (keyof CaceriaPerroEspecies)[]>>({});
  const [showAddContador, setShowAddContador] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedPerro, setExpandedPerro] = useState<string | null>(null);
  // Para la vista detail
  const [detailPerros, setDetailPerros] = useState<CaceriaPerro[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await caceriasDB.list(perreraId);
      setCacerias(data);
      setLoaded(true);
    };
    load();
  }, [perreraId]);

  const loadDetail = async (c: Caceria) => {
    const an = await caceriaAnimalesDB.listByCaceria(c.id);
    const pe = await caceriaPerrosDB.listByCaceria(c.id);
    const allPerros = await perrosDB.list(perreraId);
    if (pe.length > 0) {
      const especiesData = await caceriaPerroEspeciesDB.listByPerroIds(pe.map(p => p.id));
      const especiesMap: Record<string, CaceriaPerroEspecies> = {};
      pe.forEach(p => { especiesMap[p.id] = { levantados: [], perseguidos: [], perdidos: [], muertes: [], cobradas: [], amuestra: [] }; });
      especiesData.forEach((row: any) => {
        const campo = row.campo as keyof CaceriaPerroEspecies;
        if (especiesMap[row.caceria_perro_id]) {
          especiesMap[row.caceria_perro_id][campo].push({ especie: row.especie, cantidad: row.cantidad });
        }
      });
      setDetailPerros(pe.map(p => ({
        ...p,
        perro: allPerros.find(pp => pp.id === p.perro_id),
        especies: especiesMap[p.id],
      })));
    } else {
      setDetailPerros([]);
    }
    setAnimales(an);
    setSelected(c);
    setView('detail');
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setAnimales([]);
    setPerrosParticIds([]);
    setPerrosFormState({});
    setPerrosContadores({});
    setView('form');
  };

  const openEdit = async (c: Caceria) => {
    setEditing(c);
    setForm({ fecha: c.fecha, lugar: c.lugar, modalidad: c.modalidad, notas: c.notas });
    const an = await caceriaAnimalesDB.listByCaceria(c.id);
    const pe = await caceriaPerrosDB.listByCaceria(c.id);
    setAnimales(an);
    const ids = pe.map(p => p.perro_id);
    const newState: Record<string, PerroFormState> = {};
    const newContadores: Record<string, (keyof CaceriaPerroEspecies)[]> = {};
    if (pe.length > 0) {
      const especiesData = await caceriaPerroEspeciesDB.listByPerroIds(pe.map(p => p.id));
      pe.forEach(p => {
        const especies: CaceriaPerroEspecies = { levantados: [], perseguidos: [], perdidos: [], muertes: [], cobradas: [], amuestra: [] };
        especiesData.filter((r: any) => r.caceria_perro_id === p.id).forEach((r: any) => {
          const campo = r.campo as keyof CaceriaPerroEspecies;
          if (campo in especies) especies[campo].push({ especie: r.especie, cantidad: r.cantidad });
        });
        newState[p.perro_id] = { especies, duracion_minutos: p.duracion_minutos };
        // Detectar qué contadores tienen datos
        newContadores[p.perro_id] = (Object.keys(especies) as (keyof CaceriaPerroEspecies)[]).filter(k => especies[k].length > 0);
      });
    }
    setPerrosParticIds(ids);
    setPerrosFormState(newState);
    setPerrosContadores(newContadores);
    setView('form');
  };

  const addEspecie = () => {
    if (animales.find(a => a.especie === nuevaEspecie)) return;
    setAnimales(prev => [...prev, { id: crypto.randomUUID(), caceria_id: '', especie: nuevaEspecie, cazados: 0, movidos: 0, escapados: 0, perdidos: 0 }]);
  };

  const updateAnimal = (idx: number, field: string, val: number) => {
    setAnimales(prev => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };

  const removeAnimal = (idx: number) => setAnimales(prev => prev.filter((_, i) => i !== idx));

  const togglePerro = (perroId: string) => {
    if (perrosParticIds.includes(perroId)) {
      setPerrosParticIds(prev => prev.filter(id => id !== perroId));
      setPerrosFormState(prev => { const n = { ...prev }; delete n[perroId]; return n; });
      setPerrosContadores(prev => { const n = { ...prev }; delete n[perroId]; return n; });
    } else {
      setPerrosParticIds(prev => [...prev, perroId]);
      setPerrosFormState(prev => ({ ...prev, [perroId]: { especies: { ...EMPTY_ESPECIES }, duracion_minutos: 0 } }));
      setPerrosContadores(prev => ({ ...prev, [perroId]: [] }));
    }
  };

  const addContador = (perroId: string, campo: keyof CaceriaPerroEspecies) => {
    setPerrosContadores(prev => ({ ...prev, [perroId]: [...(prev[perroId] || []), campo] }));
    setShowAddContador(null);
  };

  const removeContador = (perroId: string, campo: keyof CaceriaPerroEspecies) => {
    setPerrosContadores(prev => ({ ...prev, [perroId]: (prev[perroId] || []).filter(c => c !== campo) }));
    updatePerroEspecies(perroId, campo, []);
  };

  const updatePerroEspecies = (perroId: string, campo: keyof CaceriaPerroEspecies, especies: CaceriaPerroEspecie[]) => {
    setPerrosFormState(prev => ({
      ...prev,
      [perroId]: { ...prev[perroId], especies: { ...prev[perroId].especies, [campo]: especies } }
    }));
  };

  const updatePerroDuracion = (perroId: string, val: number) => {
    setPerrosFormState(prev => ({ ...prev, [perroId]: { ...prev[perroId], duracion_minutos: val } }));
  };

  const save = async () => {
    if (!form.fecha) return;
    setSaving(true);
    let caceriaId: string;
    if (editing) {
      await caceriasDB.update(editing.id, form);
      caceriaId = editing.id;
      await caceriaAnimalesDB.deleteByCaceria(caceriaId);
      await caceriaPerrosDB.deleteByCaceria(caceriaId);
    } else {
      const c = await caceriasDB.insert(perreraId, { ...form, animales: undefined, perros_participantes: undefined });
      caceriaId = c.id;
    }
    if (animales.length > 0) {
      await caceriaAnimalesDB.insertMany(perreraId, animales.map(({ id: _id, ...a }) => ({ ...a, caceria_id: caceriaId })));
    }
    for (const perroId of perrosParticIds) {
      const state = perrosFormState[perroId] || { especies: EMPTY_ESPECIES, duracion_minutos: 0 };
      const { especies, duracion_minutos } = state;
      const levantados = totalEspecies(especies.levantados);
      const perseguidos = totalEspecies(especies.perseguidos);
      const perdidos = totalEspecies(especies.perdidos);
      const muertes = totalEspecies(especies.muertes);
      const [perroRow] = await caceriaPerrosDB.insertMany(perreraId, [{ caceria_id: caceriaId, perro_id: perroId, levantados, perseguidos, perdidos, muertes, duracion_minutos }]);
      if (perroRow) {
        const especiesRows: any[] = [];
        (['levantados', 'perseguidos', 'perdidos', 'muertes', 'cobradas', 'amuestra'] as const).forEach(campo => {
          especies[campo].forEach(e => {
            if (e.cantidad > 0) especiesRows.push({ caceria_perro_id: perroRow.id, campo, especie: e.especie, cantidad: e.cantidad });
          });
        });
        if (especiesRows.length > 0) await caceriaPerroEspeciesDB.insertMany(perreraId, especiesRows);
      }
    }
    const data = await caceriasDB.list(perreraId);
    setCacerias(data);
    setSaving(false);
    setView('list');
  };

  const deleteCaceria = async (id: string) => {
    if (!confirm('¿Eliminar esta cacería?')) return;
    await caceriasDB.delete(id);
    await caceriaAnimalesDB.deleteByCaceria(id);
    await caceriaPerrosDB.deleteByCaceria(id);
    const data = await caceriasDB.list(perreraId);
    setCacerias(data);
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";

  if (view === 'form') return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">{editing ? 'Editar Cacería' : 'Nueva Cacería'}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Fecha</label>
          <input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
        </div>
        <div>
          <label className="text-amber-600 text-xs mb-1 block">Modalidad</label>
          <select className={inputCls} value={form.modalidad} onChange={e => setForm(f => ({ ...f, modalidad: e.target.value }))}>
            <option value="">Seleccionar...</option>
            {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <input className={inputCls} placeholder="Lugar" value={form.lugar} onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))} />
      <textarea className={inputCls} rows={2} placeholder="Notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />

      {/* Animales */}
      <div className="bg-black/20 border border-amber-700/20 rounded-xl p-3 space-y-2">
        <p className="text-amber-400 text-sm font-medium">Animales</p>
        <div className="flex gap-2">
          <select className="flex-1 bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm focus:outline-none" value={nuevaEspecie} onChange={e => setNuevaEspecie(e.target.value)}>
            {ESPECIES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <button onClick={addEspecie} className="bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm"><Plus size={16} /></button>
        </div>
        {animales.map((a, i) => {
          const esBecada = a.especie === 'Becada';
          const campos = esBecada
            ? [{ field: 'cazados', label: 'A muestra' }, { field: 'movidos', label: 'Levantadas' }, { field: 'escapados', label: 'Cobradas' }, { field: 'perdidos', label: 'Perdidas' }]
            : [{ field: 'cazados', label: 'Cazados' }, { field: 'movidos', label: 'Movidos' }, { field: 'escapados', label: 'Escapados' }];
          return (
            <div key={i} className="bg-black/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-amber-300 text-sm font-medium">{a.especie}</span>
                <button onClick={() => removeAnimal(i)} className="text-red-600 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
              <div className={`grid gap-2 text-xs ${esBecada ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {campos.map(({ field, label }) => (
                  <div key={field}>
                    <label className="text-amber-700 block mb-1">{label}</label>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateAnimal(i, field, Math.max(0, (a as any)[field] - 1))} className="bg-black/40 border border-amber-700/40 rounded px-2 py-1 text-amber-400 hover:text-amber-200 hover:border-amber-500 transition-colors"><Minus size={12} /></button>
                      <span className="flex-1 text-center text-amber-100 font-medium">{(a as any)[field]}</span>
                      <button type="button" onClick={() => updateAnimal(i, field, (a as any)[field] + 1)} className="bg-black/40 border border-amber-700/40 rounded px-2 py-1 text-amber-400 hover:text-amber-200 hover:border-amber-500 transition-colors"><Plus size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Perros participantes */}
      {perros.length > 0 && (
        <div className="bg-black/20 border border-amber-700/20 rounded-xl p-3 space-y-2">
          <p className="text-amber-400 text-sm font-medium">Perros participantes</p>
          {perros.map(p => {
            const activo = perrosParticIds.includes(p.id);
            const state = perrosFormState[p.id];
            return (
              <div key={p.id} className="bg-black/30 rounded-lg overflow-hidden">
                {/* Cabecera: activar/desactivar perro */}
                <button
                  type="button"
                  onClick={() => togglePerro(p.id)}
                  className="w-full flex items-center gap-3 px-3 py-2"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${activo ? 'border-amber-500 bg-amber-500' : 'border-amber-700'}`}>
                    {activo && <Check size={12} className="text-white" />}
                  </div>
                  {p.foto ? <img src={p.foto} className="w-7 h-7 rounded-full object-cover" alt="" /> : null}
                  <span className="text-amber-200 text-sm">{p.nombre}</span>
                </button>

                {/* Contadores por perro */}
                {activo && state && (
                  <div className="px-3 pb-3 space-y-2 border-t border-amber-700/10 pt-2">
                    {(perrosContadores[p.id] || []).map(campo => {
                      const def = TODOS_CONTADORES.find(c => c.field === campo)!;
                      return (
                        <div key={campo} className="bg-black/30 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-1.5">
                            <span className="text-amber-300 text-sm font-medium">{def.label}</span>
                            <button type="button" onClick={() => removeContador(p.id, campo)} className="text-red-700 hover:text-red-400 ml-1"><Trash2 size={13} /></button>
                          </div>
                          <CampoEspeciesPanel
                            label=""
                            hideHeader
                            especies={state.especies[campo]}
                            onChange={esp => updatePerroEspecies(p.id, campo, esp)}
                          />
                        </div>
                      );
                    })}

                    {/* Botón + para añadir contador */}
                    <button
                      type="button"
                      onClick={() => setShowAddContador(showAddContador === p.id ? null : p.id)}
                      className="flex items-center gap-1.5 text-amber-500 hover:text-amber-300 text-xs font-medium px-2 py-1.5 rounded-lg border border-amber-700/30 hover:border-amber-600/50 bg-black/20 transition-colors"
                    >
                      <Plus size={13} /> Añadir registro
                    </button>
                    {showAddContador === p.id && (
                      <div className="bg-[#0e1a08] border border-amber-700/40 rounded-xl overflow-hidden">
                        {TODOS_CONTADORES.filter(c => !(perrosContadores[p.id] || []).includes(c.field)).map(c => (
                          <button
                            key={c.field}
                            type="button"
                            onClick={() => addContador(p.id, c.field)}
                            className="w-full text-left px-4 py-2.5 text-amber-200 text-sm hover:bg-amber-900/40 transition-colors border-b border-amber-700/20 last:border-0"
                          >
                            {c.label}
                          </button>
                        ))}
                        {TODOS_CONTADORES.filter(c => !(perrosContadores[p.id] || []).includes(c.field)).length === 0 && (
                          <p className="px-4 py-2.5 text-amber-700 text-xs">Todos añadidos</p>
                        )}
                      </div>
                    )}

                    <div className="bg-black/30 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                      <span className="text-amber-300 text-sm font-medium">Duración (min)</span>
                      <input
                        type="number"
                        min="0"
                        className="w-24 bg-black/40 border border-amber-700/30 rounded px-2 py-1 text-amber-100 text-sm text-right focus:outline-none"
                        value={state.duracion_minutos}
                        onChange={e => updatePerroDuracion(p.id, parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={save} disabled={saving} className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
        <Check size={18} /> {saving ? 'Guardando...' : 'Guardar Cacería'}
      </button>
    </div>
  );

  if (view === 'detail' && selected) {
    const totalCazados = animales.reduce((s, a) => s + a.cazados, 0);
    const totalMovidos = animales.reduce((s, a) => s + a.movidos, 0);
    const totalEscapados = animales.reduce((s, a) => s + a.escapados, 0);
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
          <h2 className="text-amber-300 font-bold text-lg">Detalle Cacería</h2>
        </div>
        <div className="bg-black/30 border border-amber-700/20 rounded-xl p-4 space-y-2">
          <div className="flex justify-between"><span className="text-amber-600 text-sm">Fecha</span><span className="text-amber-200 text-sm">{new Date(selected.fecha).toLocaleDateString('es-ES')}</span></div>
          {selected.lugar && <div className="flex justify-between"><span className="text-amber-600 text-sm">Lugar</span><span className="text-amber-200 text-sm">{selected.lugar}</span></div>}
          {selected.modalidad && <div className="flex justify-between"><span className="text-amber-600 text-sm">Modalidad</span><span className="text-amber-200 text-sm">{selected.modalidad}</span></div>}
          {selected.notas && <p className="text-amber-400 text-sm mt-2">{selected.notas}</p>}
        </div>

        {animales.length > 0 && (
          <div className="bg-black/30 border border-amber-700/20 rounded-xl p-4">
            <p className="text-amber-400 text-sm font-medium mb-3">Animales</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[['Cazados', totalCazados, 'text-green-400'], ['Movidos', totalMovidos, 'text-amber-400'], ['Escapados', totalEscapados, 'text-red-400']].map(([label, val, cls]) => (
                <div key={label as string} className="text-center bg-black/30 rounded-lg py-2">
                  <div className={`text-xl font-bold ${cls}`}>{val}</div>
                  <div className="text-amber-700 text-xs">{label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {animales.map(a => {
                const esBecada = a.especie === 'Becada';
                return (
                  <div key={a.id} className="bg-black/40 border border-amber-700/20 rounded-lg p-3">
                    <p className="text-amber-300 font-semibold text-sm mb-2">{a.especie}</p>
                    {esBecada ? (
                      <div className="grid grid-cols-2 gap-1">
                        <div className="text-center">
                          <div className="text-amber-400 font-bold text-base">{a.cazados}</div>
                          <div className="text-amber-700 text-xs">A muestra</div>
                        </div>
                        <div className="text-center">
                          <div className="text-blue-400 font-bold text-base">{a.movidos}</div>
                          <div className="text-amber-700 text-xs">Levantadas</div>
                        </div>
                        <div className="text-center">
                          <div className="text-green-400 font-bold text-base">{a.escapados}</div>
                          <div className="text-amber-700 text-xs">Cobradas</div>
                        </div>
                        <div className="text-center">
                          <div className="text-red-400 font-bold text-base">{a.perdidos ?? 0}</div>
                          <div className="text-amber-700 text-xs">Perdidas</div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1">
                        <div className="text-center">
                          <div className="text-green-400 font-bold text-base">{a.cazados}</div>
                          <div className="text-amber-700 text-xs">Cazados</div>
                        </div>
                        <div className="text-center">
                          <div className="text-amber-400 font-bold text-base">{a.movidos}</div>
                          <div className="text-amber-700 text-xs">Movidos</div>
                        </div>
                        <div className="text-center">
                          <div className="text-red-400 font-bold text-base">{a.escapados}</div>
                          <div className="text-amber-700 text-xs">Escapados</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {detailPerros.length > 0 && (
          <div className="bg-black/30 border border-amber-700/20 rounded-xl p-4">
            <p className="text-amber-400 text-sm font-medium mb-3">Informe por Perro</p>
            <div className="space-y-2">
              {detailPerros.map(pp => {
                const perro = perros.find(p => p.id === pp.perro_id);
                const isExp = expandedPerro === pp.perro_id;
                const esp = pp.especies;
                return (
                  <div key={pp.id} className="bg-black/20 rounded-lg overflow-hidden">
                    <button className="w-full flex items-center justify-between px-3 py-2" onClick={() => setExpandedPerro(isExp ? null : pp.perro_id)}>
                      <span className="text-amber-200 text-sm font-medium">{perro?.nombre || 'Perro'}</span>
                      {isExp ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-amber-600" />}
                    </button>
                    {isExp && (
                      <div className="px-3 pb-3 space-y-2 border-t border-amber-700/10 pt-2">
                        {TODOS_CONTADORES.filter(({ field }) => esp && esp[field] && esp[field].length > 0).map(({ field, label }) => {
                          const lista = esp![field];
                          const tot = totalEspecies(lista);
                          return (
                            <div key={field} className="bg-black/30 rounded-lg overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2">
                                <span className="text-amber-300 text-sm font-medium">{label}</span>
                                <span className="text-amber-200 font-bold text-sm">{tot}</span>
                              </div>
                              <div className="px-3 pb-2 space-y-1">
                                {lista.map(e => (
                                  <div key={e.especie} className="flex justify-between text-xs">
                                    <span className="text-amber-500">{e.especie}</span>
                                    <span className="text-amber-300">{e.cantidad}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        <div className="bg-black/30 rounded p-2 text-center">
                          <div className="text-amber-300 font-bold">{pp.duracion_minutos} min</div>
                          <div className="text-amber-700 text-xs">Duración</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button onClick={() => openEdit(selected)} className="w-full bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
          <Edit2 size={16} /> Editar
        </button>
      </div>
    );
  }

  if (!loaded) {
    return <div className="p-8 text-center text-amber-600">Cargando...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Cacerías</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Añadir
        </button>
      </div>

      {cacerias.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <Crosshair size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay cacerías registradas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cacerias.map(c => (
            <div key={c.id} className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
              <button onClick={() => loadDetail(c)} className="w-full px-4 py-3 text-left hover:bg-black/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-amber-200 font-medium">{new Date(c.fecha).toLocaleDateString('es-ES')}</div>
                    {c.lugar && <div className="text-amber-600 text-xs mt-0.5">{c.lugar}</div>}
                    {c.modalidad && <div className="text-amber-700 text-xs">{c.modalidad}</div>}
                  </div>
                  <Crosshair size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                </div>
              </button>
              <div className="flex border-t border-amber-700/10">
                <button onClick={() => openEdit(c)} className="flex-1 py-2 text-amber-600 hover:text-amber-400 flex justify-center transition-colors"><Edit2 size={15} /></button>
                <button onClick={() => deleteCaceria(c.id)} className="flex-1 py-2 text-red-700 hover:text-red-400 flex justify-center transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
