import { useState, useEffect } from 'react';
import { Plus, Phone, Edit2, Trash2, ArrowLeft, Check } from 'lucide-react';
import { telefonosDB } from '../lib/db';
import type { Telefono } from '../lib/types';

const TIPOS = ['personal', 'guarda', 'veterinario', 'emergencias', 'coto', 'otro'];

const EMPTY_FORM = { nombre: '', telefono: '', tipo: 'personal', notas: '' };

interface Props {
  perreraId: string;
}

export default function TelefonosSection({ perreraId }: Props) {
  const [telefonos, setTelefonos] = useState<Telefono[]>([]);
  const [, setLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<Telefono | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await telefonosDB.list(perreraId);
      setTelefonos(data);
    } catch (err) {
      console.error('Error loading telefonos:', err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { load(); }, [perreraId]);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setView('form'); };
  const openEdit = (t: Telefono) => {
    setEditing(t);
    setForm({ nombre: t.nombre, telefono: t.telefono, tipo: t.tipo, notas: t.notas });
    setView('form');
  };

  const save = async () => {
    if (!form.nombre.trim() || !form.telefono.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await telefonosDB.update(editing.id, form);
      } else {
        await telefonosDB.insert(perreraId, form);
      }
      await load();
      setView('list');
    } catch (err) {
      console.error('Error saving telefono:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteTel = async (id: string) => {
    if (!confirm('¿Eliminar?')) return;
    try {
      await telefonosDB.delete(id);
      await load();
    } catch (err) {
      console.error('Error deleting telefono:', err);
    }
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";

  if (view === 'form') return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">{editing ? 'Editar Teléfono' : 'Nuevo Teléfono'}</h2>
      </div>
      <input className={inputCls} placeholder="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
      <input className={inputCls} placeholder="Teléfono *" type="tel" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
      <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
        {TIPOS.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
      </select>
      <textarea className={inputCls} rows={2} placeholder="Notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
      <button onClick={save} disabled={saving || !form.nombre.trim() || !form.telefono.trim()} className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
        <Check size={18} /> {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );

  const grouped = TIPOS.reduce((acc, tipo) => {
    const items = telefonos.filter(t => t.tipo === tipo);
    if (items.length) acc[tipo] = items;
    return acc;
  }, {} as Record<string, Telefono[]>);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Teléfonos</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Añadir
        </button>
      </div>

      {telefonos.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <Phone size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay teléfonos guardados.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([tipo, items]) => (
          <div key={tipo}>
            <p className="text-amber-600 text-xs font-medium uppercase tracking-wider mb-2">{tipo}</p>
            <div className="space-y-2">
              {items.map(t => (
                <div key={t.id} className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
                  <a href={`tel:${t.telefono}`} className="flex items-center gap-3 px-4 py-3 hover:bg-black/20 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-900/30 border border-green-700/30 flex items-center justify-center flex-shrink-0">
                      <Phone size={16} className="text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-amber-200 font-medium text-sm">{t.nombre}</div>
                      <div className="text-green-400 text-sm font-mono">{t.telefono}</div>
                      {t.notas && <div className="text-amber-700 text-xs truncate">{t.notas}</div>}
                    </div>
                  </a>
                  <div className="flex border-t border-amber-700/10">
                    <button onClick={() => openEdit(t)} className="flex-1 py-2 text-amber-600 hover:text-amber-400 flex justify-center"><Edit2 size={15} /></button>
                    <button onClick={() => deleteTel(t.id)} className="flex-1 py-2 text-red-700 hover:text-red-400 flex justify-center"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
