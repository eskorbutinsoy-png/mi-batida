import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Batida } from '../lib/types';
import {
  createBatida, addAdminToBatida, getBatidaByCode,
  joinBatida, getUserBatidas, getMiBatidaMiembro, updateMiembroPuesto, updateMiembroEstado, deleteBatida, removeUserFromBatida, removeUserFromBatidaHistory, isAdmin, upsertPerfil,
} from '../lib/db';
import {
  Plus, Search, History, TreePine, Users,
  ChevronRight, Loader2, Copy, Check, Calendar, UserCircle, Trash2, Zap,
} from 'lucide-react';
import PerfilSection from '../sections/PerfilSection';
import HistorialDetalle from '../sections/HistorialDetalle';

interface Props {
  onEnterBatida: (batida: Batida) => void;
  inviteCode?: string | null;
  onInviteCodeConsumed?: () => void;
}

const ESPECIES_CUPO = [
  { key: 'cupo_jabali', label: 'Jabalí Macho' },
  { key: 'cupo_ciervo_macho', label: 'Ciervo Macho' },
  { key: 'cupo_ciervo_hembra', label: 'Ciervo Hembra' },
  { key: 'cupo_ciervo_cria', label: 'Cría Ciervo' },
  { key: 'cupo_corzo_macho', label: 'Corzo Macho' },
  { key: 'cupo_corzo_hembra', label: 'Corzo Hembra' },
  { key: 'cupo_corzo_cria', label: 'Cría Corzo' },
  { key: 'cupo_zorro', label: 'Zorro' },
] as const;

export default function BatidaScreen({ onEnterBatida, inviteCode, onInviteCodeConsumed }: Props) {
  const { user, perfil } = useAuth();
  const [tab, setTab] = useState<'menu' | 'crear' | 'unirse' | 'historial' | 'activa' | 'perfil'>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Crear batida
  const [nombre, setNombre] = useState('');
  const [cupos, setCupos] = useState<Record<string, number>>({});
  const [cuposCustom, setCuposCustom] = useState<Record<string, number>>({});
  const [nuevaEspecieNombre, setNuevaEspecieNombre] = useState('');
  const [nuevaEspecieCupo, setNuevaEspecieCupo] = useState('');
  const [especiesAutorizadas, setEspeciesAutorizadas] = useState<string[]>([]);
  const [tipoCrear, setTipoCrear] = useState<'perrero' | 'postura'>('postura');
  const [puestoNombreCrear, setPuestoNombreCrear] = useState('');

  // Unirse
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState<'perrero' | 'postura'>('postura');
  const [puestoNombre, setPuestoNombre] = useState('');

  // Historial
  const [batidas, setBatidas] = useState<Batida[]>([]);
  const [detalleBatida, setDetalleBatida] = useState<Batida | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const lastAutoJoinCodeRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if ((tab === 'historial' || tab === 'activa') && user) {
      getUserBatidas(user.id).then((data) => {
        if (isMounted) setBatidas(data);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [tab, user]);

  const batidasActivas = batidas.filter(b => b.estado === 'activa');
  const batidasFinalizadas = batidas.filter(b => b.estado === 'finalizada');

  async function handleCrear() {
    if (loading || !nombre.trim() || !user) return;
    setLoading(true); 
    setError('');
    try {
      // 1. Asegurar que el perfil existe con nombre
      const nombrePerfil = perfil?.nombre_completo?.trim() || `Cazador ${user.id.slice(0, 6)}`;
      console.log('1. Asegurando perfil:', { nombrePerfil });
      await upsertPerfil(user.id, { nombre_completo: nombrePerfil });
      
      // Pequeña pausa para que se sincronice
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 2. Crear batida (con cupos vacíos o con valores)
      console.log('2. Creando batida:', { nombre: nombre.trim(), cupos });
      const batida = await createBatida(nombre.trim(), { ...cupos, cupos_custom: cuposCustom, especies_autorizadas: especiesAutorizadas });
      console.log('2.1 Batida creada:', batida);
      
      // 3. Añadir como admin
      console.log('3. Añadiendo como admin:', { batida_id: batida.id, user_id: user.id });
      await addAdminToBatida(batida.id, user.id);
      console.log('3.1 Admin añadido');
      
      // 4. Hacer join con el tipo correcto
      const puestoParam = tipoCrear === 'postura' ? (puestoNombreCrear.trim() || undefined) : undefined;
      console.log('4. Haciendo join:', { batida_id: batida.id, user_id: user.id, tipo: tipoCrear, puestoParam, estado: 'activo' });
      await joinBatida(batida.id, user.id, tipoCrear, puestoParam, 'activo');
      console.log('4.1 Join completado');
      
      // 5. Limpiar formulario
      setNombre('');
      setCupos({});
      setCuposCustom({});
      setNuevaEspecieNombre('');
      setNuevaEspecieCupo('');
      setEspeciesAutorizadas([]);
      setTipoCrear('postura');
      setPuestoNombreCrear('');
      
      console.log('5. Limpieza completada, llamando onEnterBatida');
      onEnterBatida(batida);
    } catch (e: unknown) {
      console.error('❌ Error completo al crear batida:', e);
      let msg = 'Error al crear la batida';
      if (e instanceof Error) {
        msg = e.message;
      } else if (typeof e === 'object' && e !== null) {
        msg = JSON.stringify(e);
      }
      console.error('❌ Mensaje de error:', msg);
      setError(msg);
      setLoading(false);
    }
  }

  async function handleUnirse(codigoForzado?: string) {
    const cleanCodigo = (codigoForzado ?? codigo).trim().toUpperCase();
    if (loading || !cleanCodigo || !user) return;
    setLoading(true); 
    setError('');
    try {
      // Asegurar que el perfil existe
      if (!perfil?.nombre_completo) {
        await upsertPerfil(user.id, { nombre_completo: `Cazador ${user.id.slice(0, 6)}` });
      }
      const batida = await getBatidaByCode(cleanCodigo);
      if (!batida) { 
        setError('Código incorrecto o batida finalizada'); 
        setLoading(false); 
        return; 
      }
      const existing = await getMiBatidaMiembro(batida.id, user.id);
      if (existing) {
        try {
          // Reactivar y actualizar puesto/rol si existe registro previo
          await updateMiembroPuesto(existing.id, tipo === 'postura' ? (puestoNombre.trim() || null) : null, tipo);
          await updateMiembroEstado(existing.id, 'activo');
        } catch (err) { console.error('Error reactivando miembro:', err); }
        onEnterBatida(batida);
        setLoading(false);
        return;
      }
      // Hacer join en estado 'pendiente' (requiere aprobación del admin)
      console.log('Haciendo join con tipo:', tipo, 'estado: pendiente');
      await joinBatida(batida.id, user.id, tipo, tipo === 'postura' ? puestoNombre.trim() || undefined : undefined, 'pendiente');
      console.log('Join completado, entrando a batida');
      // Limpiar formulario
      setCodigo('');
      setTipo('postura');
      setPuestoNombre('');
      onEnterBatida(batida);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Error al unirse');
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!inviteCode || !user) return;
    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) return;

    setTab('unirse');
    setError('');
    setCodigo(cleanCode);

    if (lastAutoJoinCodeRef.current === cleanCode) return;
    lastAutoJoinCodeRef.current = cleanCode;

    void handleUnirse(cleanCode);
    onInviteCodeConsumed?.();
  }, [inviteCode, user]);

  async function copyCode(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      const timer = setTimeout(() => setCopiedId(null), 2000);
      return () => clearTimeout(timer);
    } catch (err) {
      console.error('No se pudo copiar el código: ', err);
    }
  }

  async function handleEnterHistorial(batida: Batida) {
    if (!user || loading) return;
    // Si la batida no está activa, abrir vista de solo lectura
    if (batida.estado !== 'activa') {
      setDetalleBatida(batida);
      return;
    }
    setLoading(true);
    try {
      const existing = await getMiBatidaMiembro(batida.id, user.id);
      if (!existing) {
        // No hay registro previo: unirse directamente como activo
        await joinBatida(batida.id, user.id, 'postura', undefined, 'activo');
      } else if (existing.estado !== 'activo') {
        // Reactivar si estaba abandonado o pendiente
        await updateMiembroEstado(existing.id, 'activo');
      }
      // Restaurar rol admin si el usuario es el creador y perdió el rol
      if (batida.creador_id === user.id) {
        const yaEsAdmin = await isAdmin(batida.id, user.id);
        if (!yaEsAdmin) {
          try { await addAdminToBatida(batida.id, user.id); } catch { /* ya existe o sin permisos */ }
        }
      }
      onEnterBatida(batida);
    } catch (e) {
      console.error('Error al entrar desde el historial:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveFromHistory(batidaId: string) {
    if (!user) return;
    if (!confirm('¿Quitar esta batida de tu historial? No se borrará la batida, solo tu participación.')) return;
    setLoading(true);
    try {
      await removeUserFromBatidaHistory(batidaId, user.id);
      const data = await getUserBatidas(user.id);
      setBatidas(data);
    } catch (err) {
      console.error('Error quitando batida del historial:', err);
    } finally {
      setLoading(false);
    }
  }

  // Acción definitiva sobre batida activa: elimina totalmente si eres creador, o abandona definitivamente si no.
  async function handleBorrarActiva(b: Batida) {
    if (!user) return;
    const esCreador = b.creador_id === user.id;
    const msg = esCreador
      ? `¿Eliminar la batida "${b.nombre}" y todos sus datos? No se puede deshacer.`
      : `¿Salir definitivamente de la batida "${b.nombre}"? Se eliminará tu participación activa.`;
    if (!confirm(msg)) return;
    setLoading(true);
    try {
      if (esCreador) {
        await deleteBatida(b.id);
      } else {
        await removeUserFromBatida(b.id, user.id);
      }
      const data = await getUserBatidas(user.id);
      setBatidas(data);
    } catch (err) {
      console.error('Error en acción definitiva de batida activa:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(batidaId: string) {
    if (!user) return;
    if (!confirm('¿Eliminar esta batida y todo su historial? Esta acción no se puede deshacer.')) return;
    setLoading(true);
    try {
      await deleteBatida(batidaId);
      const data = await getUserBatidas(user.id);
      setBatidas(data);
    } catch (err) {
      console.error('Error eliminando batida:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-forest flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b border-forest-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber rounded-lg flex items-center justify-center">
            <TreePine className="w-4 h-4 text-forest-dark" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-none">Mi Batida</h1>
            <p className="text-forest-muted text-xs">{perfil?.nombre_completo}</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => setTab('perfil')} 
          className="w-8 h-8 rounded-full bg-amber/20 border border-amber/40 flex items-center justify-center hover:bg-amber/30 transition-colors"
        >
          <span className="text-amber text-xs font-bold">
            {(perfil?.nombre_completo ?? 'U').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {tab === 'perfil' && (
          <PerfilSection onBack={() => setTab('menu')} />
        )}

        {tab === 'menu' && (
          <>
            <div className="space-y-4">
              <h2 className="text-white text-xl font-bold">¿Qué quieres hacer?</h2>
              
              <button 
                type="button"
                onClick={() => setTab('crear')}
                className="w-full bg-surface hover:bg-forest-hover border border-forest-border rounded-2xl p-5 text-left flex items-center gap-4 transition-all group"
              >
                <div className="w-12 h-12 bg-amber/20 rounded-xl flex items-center justify-center group-hover:bg-amber/30 transition-colors">
                  <Plus className="w-6 h-6 text-amber" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Crear batida</p>
                  <p className="text-forest-muted text-sm">Organiza una nueva batida e invita a tu cuadrilla</p>
                </div>
                <ChevronRight className="w-5 h-5 text-forest-muted" />
              </button>

              <button 
                type="button"
                onClick={() => setTab('unirse')}
                className="w-full bg-surface hover:bg-forest-hover border border-forest-border rounded-2xl p-5 text-left flex items-center gap-4 transition-all group"
              >
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                  <Search className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Unirse con código</p>
                  <p className="text-forest-muted text-sm">Introduce el código de invitación de la batida</p>
                </div>
                <ChevronRight className="w-5 h-5 text-forest-muted" />
              </button>

              <button 
                type="button"
                onClick={() => setTab('activa')}
                className="w-full bg-surface hover:bg-forest-hover border border-forest-border rounded-2xl p-5 text-left flex items-center gap-4 transition-all group"
              >
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                  <Zap className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Batida activa</p>
                  <p className="text-forest-muted text-sm">Batidas en curso en las que participas</p>
                </div>
                <ChevronRight className="w-5 h-5 text-forest-muted" />
              </button>

              <button 
                type="button"
                onClick={() => setTab('historial')}
                className="w-full bg-surface hover:bg-forest-hover border border-forest-border rounded-2xl p-5 text-left flex items-center gap-4 transition-all group"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                  <History className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Historial</p>
                  <p className="text-forest-muted text-sm">Batidas finalizadas</p>
                </div>
                <ChevronRight className="w-5 h-5 text-forest-muted" />
              </button>

              <button 
                type="button"
                onClick={() => setTab('perfil')}
                className="w-full bg-surface hover:bg-forest-hover border border-forest-border rounded-2xl p-5 text-left flex items-center gap-4 transition-all group"
              >
                <div className="w-12 h-12 bg-amber/20 rounded-xl flex items-center justify-center group-hover:bg-amber/30 transition-colors">
                  <UserCircle className="w-6 h-6 text-amber" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Mi perfil</p>
                  <p className="text-forest-muted text-sm">Ver y editar tus datos personales</p>
                </div>
                <ChevronRight className="w-5 h-5 text-forest-muted" />
              </button>
            </div>

            <p className="text-center text-forest-muted text-xs mt-8 pb-2">
              App creada y desarrollada por Sergio Ibero Moreno
            </p>
          </>
        )}

        {tab === 'crear' && (
          <div>
            <button type="button" onClick={() => { setTab('menu'); setError(''); }} className="text-forest-muted hover:text-amber text-sm mb-4 flex items-center gap-1 transition-colors">
              ← Volver
            </button>
            <h2 className="text-white text-xl font-bold mb-6">Nueva batida</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-forest-light font-medium mb-1.5">Nombre de la batida</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Monte Pardo - Diciembre"
                  className="w-full bg-surface border border-forest-border rounded-xl px-4 py-2.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-forest-light font-medium mb-3">Cupos por especie</label>
                <div className="grid grid-cols-2 gap-3">
                  {ESPECIES_CUPO.map(({ key, label }) => (
                    <div key={key} className="bg-surface border border-forest-border rounded-xl px-3 py-2.5">
                      <label className="block text-xs text-forest-muted mb-1">{label}</label>
                      <input
                        type="number"
                        min="0"
                        value={cupos[key] ?? ''}
                        onChange={e => setCupos(prev => ({ ...prev, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        placeholder="0"
                        className="w-full bg-transparent text-white text-sm outline-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Cupos de especies custom */}
                {Object.keys(cuposCustom).length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {Object.entries(cuposCustom).map(([esp, cupo]) => (
                      <div key={esp} className="bg-surface border border-amber/40 rounded-xl px-3 py-2.5 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-amber font-medium truncate">🎯 {esp}</p>
                          <p className="text-white text-sm font-bold">{cupo}</p>
                        </div>
                        <button type="button" onClick={() => setCuposCustom(prev => { const n = { ...prev }; delete n[esp]; return n; })}
                          className="text-red-400 hover:text-red-300 text-xs ml-2">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Añadir especie custom */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={nuevaEspecieNombre}
                    onChange={e => setNuevaEspecieNombre(e.target.value)}
                    placeholder="Especie personalizada..."
                    className="flex-1 bg-surface border border-forest-border rounded-xl px-3 py-2 text-white text-xs placeholder-forest-muted outline-none focus:border-amber"
                  />
                  <input
                    type="number"
                    min="1"
                    value={nuevaEspecieCupo}
                    onChange={e => setNuevaEspecieCupo(e.target.value)}
                    placeholder="Cupo"
                    className="w-16 bg-surface border border-forest-border rounded-xl px-2 py-2 text-white text-xs outline-none focus:border-amber"
                  />
                  <button type="button"
                    onClick={() => {
                      const nombre_esp = nuevaEspecieNombre.trim();
                      const cupo_val = parseInt(nuevaEspecieCupo) || 0;
                      if (!nombre_esp || cupo_val <= 0) return;
                      setCuposCustom(prev => ({ ...prev, [nombre_esp]: cupo_val }));
                      setNuevaEspecieNombre('');
                      setNuevaEspecieCupo('');
                    }}
                    className="bg-amber text-forest-dark rounded-xl px-3 py-2 text-xs font-bold">
                    +
                  </button>
                </div>
              </div>

              {/* Especies autorizadas */}
              <div>
                <label className="block text-xs text-forest-light font-medium mb-1">
                  Especies autorizadas
                </label>
                <p className="text-forest-muted text-xs mb-3">Deja vacío para no restringir. Si seleccionas alguna, solo esas serán visibles al registrar.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[...ESPECIES_CUPO.map(e => ({ key: e.key.replace('cupo_', ''), label: e.label })), ...Object.keys(cuposCustom).map(k => ({ key: k, label: k }))].map(({ key, label }) => {
                    const checked = especiesAutorizadas.includes(key);
                    return (
                      <button type="button" key={key}
                        onClick={() => setEspeciesAutorizadas(prev => checked ? prev.filter(e => e !== key) : [...prev, key])}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all text-left flex items-center gap-2 ${checked ? 'bg-green-700 border-green-500 text-white' : 'bg-surface border-forest-border text-forest-muted'}`}>
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-green-400 border-green-400' : 'border-forest-muted'}`}>
                          {checked && <span className="text-forest-dark text-[9px] font-bold">✓</span>}
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-forest-light font-medium mb-2">Tu rol en la batida</label>
                <div className="flex gap-3">
                  {(['postura', 'perrero'] as const).map((t) => (
                    <button 
                      type="button"
                      key={t} 
                      onClick={() => setTipoCrear(t)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${tipoCrear === t ? 'bg-amber text-forest-dark border-amber' : 'bg-surface border-forest-border text-forest-light'}`}
                    >
                      {t === 'postura' ? '🎯 Postura' : '🐕 Perrero'}
                    </button>
                  ))}
                </div>
              </div>

              {tipoCrear === 'postura' && (
                <div>
                  <label className="block text-xs text-forest-light font-medium mb-1.5">Nombre de tu puesto (opcional)</label>
                  <input
                    type="text"
                    value={puestoNombreCrear}
                    onChange={e => setPuestoNombreCrear(e.target.value)}
                    placeholder="Ej: Puesto 1 - Robledal"
                    className="w-full bg-surface border border-forest-border rounded-xl px-4 py-2.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber transition-colors"
                  />
                </div>
              )}

              {error && <p className="text-red-400 text-sm bg-red-900/20 px-4 py-2.5 rounded-xl">{error}</p>}

              <button
                type="button"
                onClick={handleCrear}
                disabled={loading || !nombre.trim()}
                className="w-full bg-amber hover:bg-amber-dark text-forest-dark font-bold py-3 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Crear batida
              </button>
            </div>
          </div>
        )}

        {tab === 'unirse' && (
          <div>
            <button type="button" onClick={() => { setTab('menu'); setError(''); }} className="text-forest-muted hover:text-amber text-sm mb-4 flex items-center gap-1 transition-colors">
              ← Volver
            </button>
            <h2 className="text-white text-xl font-bold mb-6">Unirse a batida</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-forest-light font-medium mb-1.5">Código de invitación</label>
                <input
                  type="text"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  className="w-full bg-surface border border-forest-border rounded-xl px-4 py-2.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber transition-colors font-mono text-center text-lg tracking-widest"
                />
              </div>

              <div>
                <label className="block text-xs text-forest-light font-medium mb-2">Tu rol</label>
                <div className="flex gap-3">
                  {(['postura', 'perrero'] as const).map((t) => (
                    <button 
                      type="button"
                      key={t} 
                      onClick={() => setTipo(t)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${tipo === t ? 'bg-amber text-forest-dark border-amber' : 'bg-surface border-forest-border text-forest-light'}`}
                    >
                      {t === 'postura' ? '🎯 Postura' : '🐕 Perrero'}
                    </button>
                  ))}
                </div>
              </div>

              {tipo === 'postura' && (
                <div>
                  <label className="block text-xs text-forest-light font-medium mb-1.5">Nombre de tu puesto (opcional)</label>
                  <input
                    type="text"
                    value={puestoNombre}
                    onChange={e => setPuestoNombre(e.target.value)}
                    placeholder="Ej: Puesto 3 - Robledal"
                    className="w-full bg-surface border border-forest-border rounded-xl px-4 py-2.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber transition-colors"
                  />
                </div>
              )}

              {error && <p className="text-red-400 text-sm bg-red-900/20 px-4 py-2.5 rounded-xl">{error}</p>}

              <button
                type="button"
                onClick={() => handleUnirse()}
                disabled={loading || codigo.trim().length < 6}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Unirse a la batida
              </button>
            </div>
          </div>
        )}

        {tab === 'activa' && (
          <div>
            <button type="button" onClick={() => setTab('menu')} className="text-forest-muted hover:text-amber text-sm mb-4 flex items-center gap-1 transition-colors">
              ← Volver
            </button>
            <h2 className="text-white text-xl font-bold mb-4">Batidas activas</h2>
            {batidasActivas.length === 0 ? (
              <div className="text-center py-12 text-forest-muted">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No tienes batidas activas en este momento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* La más reciente: entrada principal */}
                {(() => {
                  const principal = batidasActivas[0];
                  const otras = batidasActivas.slice(1);
                  return (
                    <>
                      <div className="bg-surface border-2 border-green-600/60 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-900/40 text-green-400">● Activa</span>
                          <span className="text-forest-muted text-xs flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(principal.created_at).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <h3 className="text-white font-bold text-base mb-3">{principal.nombre}</h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyCode(principal.codigo_invitacion, principal.id)}
                            className="flex items-center gap-1.5 text-xs text-amber hover:text-amber-dark transition-colors bg-amber/10 px-3 py-1.5 rounded-lg font-mono"
                          >
                            {copiedId === principal.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {principal.codigo_invitacion}
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleEnterHistorial(principal)}
                            className="ml-auto bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-5 py-2 rounded-xl transition-all disabled:opacity-50"
                          >
                            {loading ? 'Entrando...' : 'Entrar →'}
                          </button>
                        </div>
                      </div>

                      {otras.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-forest-muted text-xs px-1">Otras batidas activas</p>
                          {otras.map((b) => (
                            <div key={b.id} className="bg-surface border border-forest-border rounded-xl px-4 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{b.nombre}</p>
                                <p className="text-forest-muted text-xs">{new Date(b.created_at).toLocaleDateString('es-ES')}</p>
                              </div>
                              <button
                                onClick={() => handleBorrarActiva(b)}
                                disabled={loading}
                                className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Salir definitivo
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {tab === 'historial' && (
          <div>
            <button type="button" onClick={() => setTab('menu')} className="text-forest-muted hover:text-amber text-sm mb-4 flex items-center gap-1 transition-colors">
              ← Volver
            </button>
            <h2 className="text-white text-xl font-bold mb-4">Historial</h2>
            {batidasFinalizadas.length === 0 ? (
              <div className="text-center py-12 text-forest-muted">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Todavía no tienes batidas finalizadas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {batidasFinalizadas.map((b) => (
                  <div key={b.id} className="bg-surface border border-forest-border rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold">{b.nombre}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.estado === 'activa' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                            {b.estado === 'activa' ? '● Activa' : 'Finalizada'}
                          </span>
                          <span className="text-forest-muted text-xs flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(b.created_at).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {b.estado === 'activa' && (
                        <button
                          type="button"
                          onClick={() => copyCode(b.codigo_invitacion, b.id)}
                          className="flex items-center gap-1.5 text-xs text-amber hover:text-amber-dark transition-colors bg-amber/10 px-3 py-1.5 rounded-lg font-mono"
                        >
                          {copiedId === b.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {b.codigo_invitacion}
                        </button>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {b.creador_id === user?.id ? (
                          <button onClick={() => handleDelete(b.id)} disabled={loading}
                            className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => handleRemoveFromHistory(b.id)} disabled={loading}
                            className="text-forest-muted hover:text-white text-xs px-3 py-1.5 rounded-lg">Eliminar</button>
                        )}
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleEnterHistorial(b)}
                          className="bg-amber hover:bg-amber-dark text-forest-dark text-xs font-bold px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
                        >
                          {loading ? 'Entrando...' : 'Entrar →'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {detalleBatida && (
              <HistorialDetalle batida={detalleBatida} onClose={() => setDetalleBatida(null)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}