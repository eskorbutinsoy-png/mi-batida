import { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart, Plus, ArrowLeft, Check, Trash2, Edit2,
  ShoppingBag, CheckSquare, Square, Package, Euro, RotateCcw
} from 'lucide-react';
import { listaCompraDB, listaCompraItemsDB, miembrosDB } from '../lib/supabaseHogar';
import { gastosDB } from '../lib/db';
import type { ListaCompra, ListaCompraItem, MiembroHogar } from '../lib/types';

function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ListaCompraSection({ perreraId }: { perreraId: string }) {
  const [listas, setListas] = useState<ListaCompra[]>([]);
  const [miembros, setMiembros] = useState<MiembroHogar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // vistas: 'listas' | 'editar' | 'comprar'
  const [view, setView] = useState<'listas' | 'editar' | 'comprar'>('listas');
  const [listaActiva, setListaActiva] = useState<ListaCompra | null>(null);
  const [items, setItems] = useState<ListaCompraItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // nueva lista
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [creando, setCreando] = useState(false);

  // nuevo item
  const [itemNombre, setItemNombre] = useState('');
  const [itemCantidad, setItemCantidad] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // finalizar compra
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [importeStr, setImporteStr] = useState('');
  const [pagadoPor, setPagadoPor] = useState('');
  const [finalizando, setFinalizando] = useState(false);

  const loadListas = async () => {
    try {
      setLoading(true);
      setError('');
      const [l, m] = await Promise.all([listaCompraDB.list(perreraId), miembrosDB.list(perreraId)]);
      setListas(l);
      setMiembros(m);
    } catch {
      setError('Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadListas(); }, [perreraId]);

  const abrirLista = async (lista: ListaCompra, modo: 'editar' | 'comprar') => {
    setLoadingItems(true);
    setListaActiva(lista);
    setView(modo);
    setShowFinalizar(false);
    setImporteStr('');
    setPagadoPor('');
    try {
      const data = await listaCompraDB.getWithItems(lista.id);
      setItems(data?.items ?? []);
    } catch {
      setError('Error al cargar la lista');
    } finally {
      setLoadingItems(false);
    }
  };

  const crearLista = async () => {
    if (!nuevaNombre.trim()) return;
    setCreando(true);
    try {
      const nueva = await listaCompraDB.insert(
        perreraId,
        nuevaNombre.trim(),
        new Date().toISOString().split('T')[0]
      );
      setNuevaNombre('');
      await loadListas();
      await abrirLista(nueva, 'editar');
    } catch {
      setError('Error al crear la lista');
    } finally {
      setCreando(false);
    }
  };

  const addItem = async () => {
    if (!itemNombre.trim() || !listaActiva) return;
    setAddingItem(true);
    try {
      const item = await listaCompraItemsDB.insert(perreraId, listaActiva.id, itemNombre.trim(), itemCantidad.trim());
      setItems(prev => [...prev, item]);
      setItemNombre('');
      setItemCantidad('');
      setTimeout(() => itemInputRef.current?.focus(), 50);
    } catch {
      setError('Error al añadir');
    } finally {
      setAddingItem(false);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await listaCompraItemsDB.delete(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch {
      setError('Error al eliminar');
    }
  };

  const toggleCogido = async (item: ListaCompraItem) => {
    try {
      await listaCompraItemsDB.toggleCogido(item.id, !item.cogido);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, cogido: !i.cogido } : i));
    } catch {
      setError('Error al actualizar');
    }
  };

  const finalizar = async () => {
    if (!listaActiva || !importeStr) return;
    setFinalizando(true);
    try {
      const importe = parseFloat(importeStr.replace(',', '.'));
      await listaCompraDB.finalizar(listaActiva.id, importe, pagadoPor);

      // Registrar en gastos automáticamente
      gastosDB.insert(perreraId, {
        fecha: new Date().toISOString().split('T')[0],
        categoria: 'comida',
        descripcion: `Lista: ${listaActiva.nombre}`,
        importe,
        notas: 'Registrado desde Lista de la Compra',
        pagado_por: pagadoPor,
      });

      await loadListas();
      setView('listas');
      setShowFinalizar(false);
    } catch {
      setError('Error al finalizar');
    } finally {
      setFinalizando(false);
    }
  };

  const reabrir = async (lista: ListaCompra) => {
    try {
      await listaCompraDB.reabrir(lista.id);
      await loadListas();
    } catch {
      setError('Error al reabrir');
    }
  };

  const deleteLista = async (id: string) => {
    if (!confirm('¿Eliminar esta lista y todos sus artículos?')) return;
    try {
      await listaCompraDB.delete(id);
      setListas(prev => prev.filter(l => l.id !== id));
    } catch {
      setError('Error al eliminar');
    }
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";
  const getMiembroColor = (nombre: string) =>
    miembros.find(m => m.nombre === nombre)?.color ?? '#d97706';

  // ---- VISTA EDITAR LISTA ----
  if (view === 'editar' && listaActiva) {
    const pendientes = items.filter(i => !i.cogido).length;
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('listas'); loadListas(); }} className="text-amber-500 hover:text-amber-300">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-amber-300 font-bold text-lg truncate">{listaActiva.nombre}</h2>
            <p className="text-amber-700 text-xs">{items.length} artículos · {pendientes} pendientes</p>
          </div>
          <button
            onClick={() => abrirLista(listaActiva, 'comprar')}
            disabled={items.length === 0}
            className="flex items-center gap-1.5 bg-green-800/50 hover:bg-green-700/50 border border-green-600/40 text-green-300 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
          >
            <ShoppingBag size={14} /> Ir de compras
          </button>
        </div>

        {/* Añadir item */}
        <div className="bg-black/20 border border-amber-700/20 rounded-xl p-3 space-y-2">
          <div className="flex gap-2">
            <input
              ref={itemInputRef}
              className={inputCls}
              placeholder="Nombre del artículo *"
              value={itemNombre}
              onChange={e => setItemNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !addingItem && addItem()}
            />
            <input
              className="w-24 bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500 flex-shrink-0"
              placeholder="Cant."
              value={itemCantidad}
              onChange={e => setItemCantidad(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !addingItem && addItem()}
            />
            <button
              onClick={addItem}
              disabled={addingItem || !itemNombre.trim()}
              className="flex-shrink-0 bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white p-2 rounded-lg transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {loadingItems ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-amber-700">
            <Package size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sin artículos. Añade el primero arriba.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 bg-black/20 border border-amber-700/15 rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-amber-200 text-sm">{item.nombre}</span>
                  {item.cantidad && <span className="text-amber-700 text-xs ml-2">{item.cantidad}</span>}
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-red-800 hover:text-red-400 p-1 transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- VISTA IR DE COMPRAS ----
  if (view === 'comprar' && listaActiva) {
    const cogidos = items.filter(i => i.cogido).length;
    const todos = items.length;
    const todosCogidos = todos > 0 && cogidos === todos;
    const pendientesItems = items.filter(i => !i.cogido);
    const cogidosItems = items.filter(i => i.cogido);

    return (
      <div className="p-4 space-y-4 pb-32">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('editar')} className="text-amber-500 hover:text-amber-300">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-amber-300 font-bold text-lg truncate">{listaActiva.nombre}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: todos > 0 ? `${(cogidos / todos) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-amber-700 text-xs flex-shrink-0">{cogidos}/{todos}</span>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Pendientes */}
        {pendientesItems.length > 0 && (
          <div className="space-y-1.5">
            {pendientesItems.map(item => (
              <button
                key={item.id}
                onClick={() => toggleCogido(item)}
                className="w-full flex items-center gap-3 bg-black/30 border border-amber-700/20 rounded-xl px-4 py-3 text-left hover:bg-black/40 transition-colors active:scale-98"
              >
                <Square size={22} className="text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-amber-200 text-sm font-medium">{item.nombre}</p>
                  {item.cantidad && <p className="text-amber-700 text-xs">{item.cantidad}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Cogidos */}
        {cogidosItems.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-amber-800 text-xs px-1">Cogidos ({cogidosItems.length})</p>
            {cogidosItems.map(item => (
              <button
                key={item.id}
                onClick={() => toggleCogido(item)}
                className="w-full flex items-center gap-3 bg-green-900/10 border border-green-700/15 rounded-xl px-4 py-2.5 text-left opacity-60 hover:opacity-80 transition-opacity"
              >
                <CheckSquare size={22} className="text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-amber-400 text-sm line-through">{item.nombre}</p>
                  {item.cantidad && <p className="text-amber-700 text-xs">{item.cantidad}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Botón finalizar — fijo abajo */}
        <div className="fixed bottom-16 left-0 right-0 px-4 py-3 bg-gradient-to-t from-[#0a1a05] to-transparent">
          {!showFinalizar ? (
            <button
              onClick={() => setShowFinalizar(true)}
              className={`w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-xl ${
                todosCogidos
                  ? 'bg-green-700 hover:bg-green-600 text-white animate-pulse'
                  : 'bg-amber-700/80 hover:bg-amber-600 text-white'
              }`}
            >
              <Euro size={18} />
              {todosCogidos ? 'Todo cogido — Finalizar compra' : 'Finalizar compra'}
            </button>
          ) : (
            <div className="bg-[#0d2408] border border-amber-700/40 rounded-2xl p-4 space-y-3 shadow-2xl">
              <p className="text-amber-300 font-semibold text-sm">¿Cuánto has gastado?</p>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls + ' text-lg font-bold'}
                placeholder="0.00 €"
                value={importeStr}
                onChange={e => setImporteStr(e.target.value)}
                autoFocus
              />
              <div>
                <p className="text-amber-700 text-xs mb-1.5">¿Quién ha pagado?</p>
                {miembros.length === 0 ? (
                  <p className="text-amber-800 text-xs italic">Sin miembros configurados</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPagadoPor('')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        !pagadoPor ? 'bg-amber-700/60 border-amber-500 text-amber-100' : 'bg-black/20 border-amber-700/20 text-amber-600'
                      }`}
                    >
                      Sin asignar
                    </button>
                    {miembros.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPagadoPor(m.nombre)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          pagadoPor === m.nombre ? 'scale-105 text-white' : 'bg-black/20 border-amber-700/20 text-amber-500'
                        }`}
                        style={pagadoPor === m.nombre ? { backgroundColor: m.color + '40', borderColor: m.color, color: m.color } : {}}
                      >
                        {m.foto ? (
                          <img src={m.foto} className="w-4 h-4 rounded-full object-cover" alt="" />
                        ) : (
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                        )}
                        {m.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFinalizar(false)}
                  className="flex-1 py-2.5 rounded-xl border border-amber-700/30 text-amber-600 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={finalizar}
                  disabled={finalizando || !importeStr}
                  className="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 disabled:bg-green-900/40 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Check size={16} /> {finalizando ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- VISTA LISTADO DE LISTAS ----
  const activas = listas.filter(l => !l.finalizada);
  const finalizadas = listas.filter(l => l.finalizada);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Lista de la Compra</h2>
      </div>

      {/* Crear nueva lista */}
      <div className="flex gap-2">
        <input
          className={inputCls}
          placeholder="Nombre de la lista..."
          value={nuevaNombre}
          onChange={e => setNuevaNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !creando && crearLista()}
        />
        <button
          onClick={crearLista}
          disabled={creando || !nuevaNombre.trim()}
          className="flex-shrink-0 flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Nueva
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={loadListas} className="text-red-300 text-xs underline">Reintentar</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : listas.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <ShoppingCart size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay listas creadas.</p>
          <p className="text-xs mt-1 opacity-60">Escribe un nombre y pulsa Nueva</p>
        </div>
      ) : (
        <>
          {/* Listas activas */}
          {activas.length > 0 && (
            <div className="space-y-2">
              <p className="text-amber-600 text-xs uppercase tracking-wider px-1">Activas</p>
              {activas.map(lista => (
                <div key={lista.id} className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3">
                    <ShoppingCart size={18} className="text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-amber-200 font-semibold text-sm truncate">{lista.nombre}</p>
                      <p className="text-amber-700 text-xs">{new Date(lista.fecha + 'T00:00:00').toLocaleDateString('es-ES')}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => abrirLista(lista, 'editar')}
                        className="p-2 text-amber-600 hover:text-amber-400 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => abrirLista(lista, 'comprar')}
                        className="flex items-center gap-1 bg-green-900/40 hover:bg-green-800/40 border border-green-700/30 text-green-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        <ShoppingBag size={12} /> Comprar
                      </button>
                      <button
                        onClick={() => deleteLista(lista.id)}
                        className="p-2 text-red-800 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Listas finalizadas */}
          {finalizadas.length > 0 && (
            <div className="space-y-2">
              <p className="text-amber-700 text-xs uppercase tracking-wider px-1">Finalizadas</p>
              {finalizadas.map(lista => {
                const color = lista.pagado_por ? getMiembroColor(lista.pagado_por) : '#78716c';
                return (
                  <div key={lista.id} className="bg-black/20 border border-green-700/15 rounded-xl overflow-hidden opacity-75">
                    <div className="px-4 py-3 flex items-center gap-3">
                      <Check size={18} className="text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-300 font-medium text-sm truncate">{lista.nombre}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-amber-700 text-xs">{new Date(lista.fecha + 'T00:00:00').toLocaleDateString('es-ES')}</span>
                          {lista.importe_final != null && (
                            <span className="text-green-400 font-semibold text-xs">{fmt(lista.importe_final)} €</span>
                          )}
                          {lista.pagado_por && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 font-medium"
                              style={{ backgroundColor: color + '25', color, border: `1px solid ${color}50` }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                              {lista.pagado_por}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => reabrir(lista)} className="p-2 text-amber-700 hover:text-amber-400 transition-colors" title="Reabrir">
                          <RotateCcw size={14} />
                        </button>
                        <button onClick={() => deleteLista(lista.id)} className="p-2 text-red-800 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
