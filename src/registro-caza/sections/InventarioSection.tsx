import { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Trash2, Edit2, Check, X, AlertTriangle,
  ChevronDown, ChevronUp, Boxes
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Item {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  unidad: string;
  cantidad_minima: number;
  notas: string;
}

interface Props {
  perreraId: string;
}

const CATEGORIAS = ['Alimentación', 'Medicamentos', 'Equipamiento', 'Higiene', 'Accesorios', 'General'];
const UNIDADES = ['sacos', 'kg', 'g', 'unidades', 'cajas', 'botes', 'litros', 'ml', 'paquetes'];

const EMPTY: Omit<Item, 'id'> = {
  nombre: '', categoria: 'Alimentación', cantidad: 0,
  unidad: 'sacos', cantidad_minima: 1, notas: '',
};

export default function InventarioSection({ perreraId }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Item, 'id'>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState<string>('Todos');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(CATEGORIAS));

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('inventario')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('categoria')
      .order('nombre');
    setItems((data ?? []) as Item[]);
    setLoading(false);
  }, [perreraId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (item: Item) => {
    setEditId(item.id);
    setForm({ nombre: item.nombre, categoria: item.categoria, cantidad: item.cantidad, unidad: item.unidad, cantidad_minima: item.cantidad_minima, notas: item.notas });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    if (editId) {
      await supabase.from('inventario').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editId);
    } else {
      await supabase.from('inventario').insert({ ...form, perrera_id: perreraId });
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    load();
  };

  const ajustarCantidad = async (item: Item, delta: number) => {
    const nueva = Math.max(0, item.cantidad + delta);
    await supabase.from('inventario').update({ cantidad: nueva, updated_at: new Date().toISOString() }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, cantidad: nueva } : i));
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este producto del inventario?')) return;
    await supabase.from('inventario').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const n = new Set(prev);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  };

  const agotados = items.filter(i => i.cantidad <= i.cantidad_minima);
  const filtered = filtro === 'Todos' ? items : filtro === 'Bajo stock' ? agotados : items.filter(i => i.categoria === filtro);
  const cats = [...new Set(filtered.map(i => i.categoria))];

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-xl px-3 py-2.5 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors";
  const selectCls = inputCls + " appearance-none";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes size={20} className="text-amber-500" />
          <h2 className="text-amber-300 font-bold text-lg">Inventario</h2>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-amber-700/60 hover:bg-amber-700/80 text-amber-200 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Añadir
        </button>
      </div>

      {/* Alertas de bajo stock */}
      {agotados.length > 0 && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-xs font-semibold">{agotados.length} producto{agotados.length > 1 ? 's' : ''} con stock bajo</p>
            <p className="text-red-500 text-xs mt-0.5">{agotados.map(i => i.nombre).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {['Todos', 'Bajo stock', ...CATEGORIAS].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtro === f ? 'bg-amber-700/70 text-amber-200' : 'bg-black/30 text-amber-600 hover:text-amber-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-black/40 border border-amber-700/30 rounded-2xl p-4 space-y-3">
          <h3 className="text-amber-300 font-semibold text-sm">{editId ? 'Editar producto' : 'Nuevo producto'}</h3>
          <div>
            <label className="text-amber-600 text-xs mb-1 block">Nombre del producto</label>
            <input className={inputCls} placeholder="Ej: Pienso Royal Canin" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-amber-600 text-xs mb-1 block">Categoría</label>
              <select className={selectCls} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-amber-600 text-xs mb-1 block">Unidad</label>
              <select className={selectCls} value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-amber-600 text-xs mb-1 block">Cantidad actual</label>
              <input type="number" min="0" className={inputCls} value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="text-amber-600 text-xs mb-1 block">Mínimo (alerta)</label>
              <input type="number" min="0" className={inputCls} value={form.cantidad_minima} onChange={e => setForm(f => ({ ...f, cantidad_minima: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div>
            <label className="text-amber-600 text-xs mb-1 block">Notas</label>
            <input className={inputCls} placeholder="Marca, proveedor..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.nombre.trim()} className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
              <Check size={15} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-black/30 border border-amber-700/30 text-amber-500 rounded-xl text-sm">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <Package size={36} className="mx-auto mb-2 text-amber-800 opacity-40" />
          <p className="text-amber-700 text-sm">{items.length === 0 ? 'Sin productos. Añade el primero.' : 'Sin resultados para este filtro.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cats.map(cat => {
            const catItems = filtered.filter(i => i.categoria === cat);
            const expanded = expandedCats.has(cat);
            return (
              <div key={cat} className="bg-black/20 border border-amber-700/15 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-semibold text-sm">{cat}</span>
                    <span className="text-xs text-amber-700 bg-black/30 px-2 py-0.5 rounded-full">{catItems.length}</span>
                  </div>
                  {expanded ? <ChevronUp size={15} className="text-amber-700" /> : <ChevronDown size={15} className="text-amber-700" />}
                </button>

                {expanded && (
                  <div className="divide-y divide-amber-700/10">
                    {catItems.map(item => {
                      const bajo = item.cantidad <= item.cantidad_minima;
                      return (
                        <div key={item.id} className={`px-4 py-3 ${bajo ? 'bg-red-900/10' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-amber-100 text-sm font-medium truncate">{item.nombre}</p>
                                {bajo && <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />}
                              </div>
                              {item.notas && <p className="text-amber-700 text-xs truncate mt-0.5">{item.notas}</p>}
                            </div>

                            {/* Contador */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => ajustarCantidad(item, -1)}
                                className="w-7 h-7 rounded-lg bg-black/40 border border-amber-700/30 text-amber-400 hover:bg-amber-900/40 transition-colors flex items-center justify-center text-lg leading-none"
                              >
                                −
                              </button>
                              <div className="text-center min-w-[50px]">
                                <span className={`font-bold text-base ${bajo ? 'text-red-400' : 'text-amber-200'}`}>{item.cantidad}</span>
                                <span className="text-amber-700 text-xs block leading-none">{item.unidad}</span>
                              </div>
                              <button
                                onClick={() => ajustarCantidad(item, 1)}
                                className="w-7 h-7 rounded-lg bg-black/40 border border-amber-700/30 text-amber-400 hover:bg-amber-900/40 transition-colors flex items-center justify-center text-lg leading-none"
                              >
                                +
                              </button>
                            </div>

                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => openEdit(item)} className="p-1.5 text-amber-700 hover:text-amber-400 transition-colors">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => del(item.id)} className="p-1.5 text-red-800 hover:text-red-400 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Barra de stock */}
                          {item.cantidad_minima > 0 && (
                            <div className="mt-2">
                              <div className="h-1 bg-black/30 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${bajo ? 'bg-red-500' : 'bg-amber-600'}`}
                                  style={{ width: `${Math.min(100, (item.cantidad / (item.cantidad_minima * 3)) * 100)}%` }}
                                />
                              </div>
                              <p className="text-amber-800 text-xs mt-0.5">Mínimo: {item.cantidad_minima} {item.unidad}</p>
                            </div>
                          )}
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
