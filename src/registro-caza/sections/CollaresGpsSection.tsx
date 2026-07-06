import { useState, useEffect } from 'react';
import { Plus, Radio, Edit2, Trash2, ArrowLeft, Check, Hash, Zap, FileText, ChevronRight } from 'lucide-react';
import { collaresGpsDB } from '../lib/db';
import type { CollarGps } from '../lib/types';

const EMPTY_FORM = { nombre: '', id_collar: '', codigo_adiestramiento: '', notas: '' };

interface Props {
  perreraId: string;
}

export default function CollaresGpsSection({ perreraId }: Props) {
  const [collares, setCollares] = useState<CollarGps[]>([]);
  const [, setLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selected, setSelected] = useState<CollarGps | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<CollarGps | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await collaresGpsDB.list(perreraId);
      setCollares(data);
    } catch (err) {
      console.error('Error loading collares GPS:', err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { load(); }, [perreraId]);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setView('form'); };

  const openEdit = (c: CollarGps) => {
    setEditing(c);
    setForm({ nombre: c.nombre, id_collar: c.id_collar, codigo_adiestramiento: c.codigo_adiestramiento, notas: c.notas });
    setView('form');
  };

  const openDetail = (c: CollarGps) => { setSelected(c); setView('detail'); };

  const save = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        id_collar: form.id_collar.trim(),
        codigo_adiestramiento: form.codigo_adiestramiento.trim(),
        notas: form.notas.trim(),
      };
      if (editing) {
        await collaresGpsDB.update(editing.id, payload);
      } else {
        await collaresGpsDB.insert(perreraId, payload);
      }
      await load();
      setView('list');
    } catch (err) {
      console.error('Error saving collar GPS:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteCollar = async (id: string) => {
    if (!confirm('¿Eliminar este collar GPS?')) return;
    try {
      await collaresGpsDB.delete(id);
      await load();
      if (view === 'detail') setView('list');
    } catch (err) {
      console.error('Error deleting collar GPS:', err);
    }
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors";

  // --- FORMULARIO ---
  if (view === 'form') return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setView(editing ? 'detail' : 'list')} className="text-amber-500 hover:text-amber-300 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-amber-300 font-bold text-lg">{editing ? 'Editar Collar' : 'Nuevo Collar GPS'}</h2>
      </div>

      {/* Nombre del collar */}
      <div>
        <label className="text-amber-600 text-xs uppercase tracking-wider mb-2 block">Nombre del collar *</label>
        <input
          className={inputCls}
          placeholder="Ej: Collar de Rex, GPS Garmin 1..."
          value={form.nombre}
          onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
        />
      </div>

      {/* ID del collar */}
      <div className="bg-black/20 border border-amber-700/15 rounded-2xl p-4 space-y-4">
        <div>
          <label className="flex items-center gap-2 text-amber-600 text-xs uppercase tracking-wider mb-2">
            <Hash size={12} /> ID del collar
          </label>
          <input
            className={inputCls}
            placeholder="Número de identificación del collar"
            value={form.id_collar}
            onChange={e => setForm(f => ({ ...f, id_collar: e.target.value }))}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-amber-600 text-xs uppercase tracking-wider mb-2">
            <Zap size={12} /> Código de adiestramiento
          </label>
          <input
            className={inputCls}
            placeholder="Código de adiestramiento del collar"
            value={form.codigo_adiestramiento}
            onChange={e => setForm(f => ({ ...f, codigo_adiestramiento: e.target.value }))}
          />
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="flex items-center gap-2 text-amber-600 text-xs uppercase tracking-wider mb-2">
          <FileText size={12} /> Notas
        </label>
        <textarea
          className={inputCls}
          rows={4}
          placeholder="Notas adicionales sobre el collar..."
          value={form.notas}
          onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
        />
      </div>

      <button
        onClick={save}
        disabled={saving || !form.nombre.trim()}
        className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Check size={18} /> {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );

  // --- DETALLE ---
  if (view === 'detail' && selected) {
    const collar = collares.find(c => c.id === selected.id) ?? selected;
    return (
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => openEdit(collar)}
              className="flex items-center gap-1.5 bg-amber-700/30 hover:bg-amber-700/50 text-amber-300 border border-amber-700/30 px-3 py-2 rounded-xl text-sm transition-colors"
            >
              <Edit2 size={14} /> Editar
            </button>
            <button
              onClick={() => deleteCollar(collar.id)}
              className="flex items-center gap-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/30 px-3 py-2 rounded-xl text-sm transition-colors"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>

        {/* Cabecera */}
        <div className="flex items-center gap-4 py-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-900/30 border-2 border-amber-700/40 flex items-center justify-center flex-shrink-0">
            <Radio size={30} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-amber-200 font-bold text-xl">{collar.nombre}</h2>
            <p className="text-amber-700 text-xs mt-0.5">
              Añadido {new Date(collar.created_at).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>

        {/* Datos principales */}
        <div className="bg-black/30 border border-amber-700/20 rounded-2xl divide-y divide-amber-700/10 overflow-hidden">
          <div className="px-5 py-4 flex items-start gap-3">
            <Hash size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-amber-600 text-xs uppercase tracking-wider mb-1">ID del collar</p>
              {collar.id_collar ? (
                <p className="text-amber-100 font-mono text-base font-semibold">{collar.id_collar}</p>
              ) : (
                <p className="text-amber-800 text-sm italic">Sin especificar</p>
              )}
            </div>
          </div>
          <div className="px-5 py-4 flex items-start gap-3">
            <Zap size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-amber-600 text-xs uppercase tracking-wider mb-1">Código de adiestramiento</p>
              {collar.codigo_adiestramiento ? (
                <p className="text-amber-100 font-mono text-base font-semibold">{collar.codigo_adiestramiento}</p>
              ) : (
                <p className="text-amber-800 text-sm italic">Sin especificar</p>
              )}
            </div>
          </div>
        </div>

        {/* Notas */}
        {collar.notas && (
          <div className="bg-black/20 border border-amber-700/15 rounded-2xl px-5 py-4">
            <p className="flex items-center gap-2 text-amber-600 text-xs uppercase tracking-wider mb-2">
              <FileText size={12} /> Notas
            </p>
            <p className="text-amber-300 text-sm leading-relaxed whitespace-pre-wrap">{collar.notas}</p>
          </div>
        )}

        {!collar.notas && (
          <div className="bg-black/10 border border-dashed border-amber-700/20 rounded-2xl px-5 py-4 text-center">
            <p className="text-amber-800 text-sm italic">Sin notas</p>
          </div>
        )}
      </div>
    );
  }

  // --- LISTADO ---
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Mis Collares GPS</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Añadir
        </button>
      </div>

      {collares.length === 0 ? (
        <div className="text-center py-16 text-amber-700">
          <Radio size={52} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium">Sin collares GPS registrados</p>
          <p className="text-xs mt-1 opacity-60">Pulsa Añadir para registrar el primero</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collares.map(c => (
            <button
              key={c.id}
              onClick={() => openDetail(c)}
              className="w-full bg-black/30 border border-amber-700/20 hover:border-amber-600/40 hover:bg-black/40 rounded-2xl overflow-hidden transition-all text-left group"
            >
              <div className="px-4 py-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-900/30 border border-amber-700/30 flex items-center justify-center flex-shrink-0 group-hover:border-amber-600/50 transition-colors">
                  <Radio size={22} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-200 font-semibold text-base">{c.nombre}</p>
                  <div className="flex gap-3 mt-1">
                    {c.id_collar && (
                      <span className="text-amber-700 text-xs flex items-center gap-1">
                        <Hash size={10} /> {c.id_collar}
                      </span>
                    )}
                    {c.codigo_adiestramiento && (
                      <span className="text-amber-700 text-xs flex items-center gap-1">
                        <Zap size={10} /> {c.codigo_adiestramiento}
                      </span>
                    )}
                    {!c.id_collar && !c.codigo_adiestramiento && (
                      <span className="text-amber-800 text-xs italic">Sin datos configurados</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-amber-700 group-hover:text-amber-500 flex-shrink-0 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
