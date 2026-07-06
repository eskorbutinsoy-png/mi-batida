import { useState, useEffect, useRef } from 'react';
import { Plus, Users, Edit2, Trash2, Check, ArrowLeft, Camera, X } from 'lucide-react';
import { miembrosDB } from '../lib/supabaseHogar';
import { useAuth } from '../contexts/AuthContext';
import type { MiembroHogar } from '../lib/types';

const COLORES = [
  '#d97706', '#dc2626', '#16a34a', '#2563eb', '#9333ea',
  '#db2777', '#ea580c', '#0891b2', '#65a30d', '#7c3aed',
];

export default function HogarSection() {
  const { perrera } = useAuth();
  const perreraId = perrera?.id;
  const [miembros, setMiembros] = useState<MiembroHogar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<MiembroHogar | null>(null);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(COLORES[0]);
  const [foto, setFoto] = useState('');
  const [saving, setSaving] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!perreraId) return;
    try {
      setLoading(true);
      setError('');
      const data = await miembrosDB.list(perreraId);
      setMiembros(data);
    } catch {
      setError('Error al cargar los miembros del hogar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [perreraId]);

  const openNew = () => {
    setEditing(null);
    setNombre('');
    setColor(COLORES[miembros.length % COLORES.length]);
    setFoto('');
    setView('form');
  };

  const openEdit = (m: MiembroHogar) => {
    setEditing(m);
    setNombre(m.nombre);
    setColor(m.color);
    setFoto(m.foto ?? '');
    setView('form');
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFoto((ev.target?.result as string) ?? '');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const save = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await miembrosDB.update(editing.id, nombre.trim(), color, foto);
      } else {
        await miembrosDB.insert(nombre.trim(), color, foto);
      }
      await load();
      setView('list');
    } catch {
      setError('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const deleteMiembro = async (id: string) => {
    if (!confirm('¿Eliminar este miembro? Se desasignarán sus tareas y rutinas.')) return;
    try {
      await miembrosDB.delete(id);
      await load();
    } catch {
      setError('Error al eliminar');
    }
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500";

  if (view === 'form') return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">{editing ? 'Editar Miembro' : 'Nuevo Miembro'}</h2>
      </div>

      {/* Foto de perfil */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {foto ? (
            <img
              src={foto}
              className="w-24 h-24 rounded-full object-cover border-2 border-amber-600/60 shadow-lg"
              alt=""
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold border-2 border-amber-700/40 shadow-lg"
              style={{ backgroundColor: color }}
            >
              {nombre.trim() ? nombre.trim()[0].toUpperCase() : '?'}
            </div>
          )}
          {foto && (
            <button
              onClick={() => setFoto('')}
              className="absolute -top-1 -right-1 w-6 h-6 bg-red-700 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => fotoInputRef.current?.click()}
          className="flex items-center gap-2 bg-black/30 border border-amber-700/30 text-amber-400 hover:text-amber-300 px-4 py-2 rounded-xl text-sm transition-colors"
        >
          <Camera size={15} />
          {foto ? 'Cambiar foto' : 'Añadir foto de perfil'}
        </button>
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFotoChange}
        />
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-1 block">Nombre *</label>
        <input
          className={inputCls}
          placeholder="Nombre del miembro"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="text-amber-600 text-xs mb-2 block">Color del avatar</label>
        <div className="flex flex-wrap gap-3">
          {COLORES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-9 h-9 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-black scale-110 ring-white' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !nombre.trim()}
        className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Check size={18} /> {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Miembros del Hogar</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Añadir
        </button>
      </div>

      <div className="bg-amber-900/10 border border-amber-700/20 rounded-xl p-3">
        <p className="text-amber-600 text-xs leading-relaxed">
          Los miembros del hogar se guardan en la nube y son visibles desde todos los dispositivos.
          Utilízalos para asignar gastos, tareas y rutinas.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={load} className="text-red-300 text-xs mt-1 underline">Reintentar</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : miembros.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <Users size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay miembros registrados.</p>
          <p className="text-xs mt-1 opacity-60">Añade a las personas de tu hogar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {miembros.map(m => (
            <div key={m.id} className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3">
                {m.foto ? (
                  <img
                    src={m.foto}
                    className="w-12 h-12 rounded-full object-cover border-2 flex-shrink-0"
                    style={{ borderColor: m.color + '80' }}
                    alt=""
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.nombre[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-amber-200 font-semibold truncate">{m.nombre}</p>
                  <p className="text-amber-700 text-xs">Miembro del hogar</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(m)} className="p-2 text-amber-600 hover:text-amber-400 transition-colors"><Edit2 size={15} /></button>
                  <button onClick={() => deleteMiembro(m.id)} className="p-2 text-red-700 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
