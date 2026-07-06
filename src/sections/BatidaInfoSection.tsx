import { useState, useMemo, useEffect } from 'react';
import type { Batida, BatidaMiembro } from '../lib/types';
import {
  updateMiembroEstado, updateMiembroSilenciado, expulsarMiembro,
  promoverAdmin, finalizarBatida, getMiBatidaMiembro, removeUserFromBatida,
  upsertPerfil,
} from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield, VolumeX, Volume2,
  UserX, UserCheck, Flag, LogOut, Loader2, Users, Share2, Copy, Check,
} from 'lucide-react';

interface Props {
  batida: Batida;
  miembros: BatidaMiembro[];
  adminIds: Set<string>;
  miMiembro: BatidaMiembro | null;
  isAdmin: boolean;
  onLeave: () => void;
  onRefresh: () => void;
  onBack: () => void;
}

export default function BatidaInfoSection({
  batida, miembros, adminIds, miMiembro, isAdmin, onLeave, onRefresh, onBack,
}: Props) {
  const { user, perfil, refreshPerfil } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmFinalizar, setConfirmFinalizar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(perfil?.nombre_completo ?? '');
  const [savingName, setSavingName] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(batida.codigo_invitacion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback silencioso */ }
  }

  function handleShareWhatsApp() {
    const code = batida.codigo_invitacion;
    const deepLink = `mibatida://join?code=${encodeURIComponent(code)}`;
    const webLink = `${window.location.origin}/?invite=${encodeURIComponent(code)}`;
    const texto = encodeURIComponent(
      `¡Únete a mi batida "${batida.nombre}"!\n` +
      `${webLink}\n` +
      `Abrir directo en app: ${deepLink}\n` +
      `Código de invitación: ${code}`,
    );
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  }

  useEffect(() => {
    setNuevoNombre(perfil?.nombre_completo ?? '');
  }, [perfil]);

  // Clasificación eficiente de miembros
  const { activos, pendientes } = useMemo(() => {
    const activosList = miembros.filter(m => m.estado === 'activo');
    const pendientesList = miembros.filter(m => m.estado === 'pendiente');
    return {
      activos: activosList,
      pendientes: pendientesList,
    };
  }, [miembros, user?.id]);

  // Interceptor seguro de acciones asíncronas para evitar bloqueos por falta de cobertura
  async function doAction(id: string, action: () => Promise<void>) {
    setLoading(id);
    try {
      await action();
      await onRefresh();
    } catch (error) {
      console.error("Error ejecutando acción en la batida:", error);
    } finally {
      setLoading(null);
    }
  }

  async function handleAprobar(m: BatidaMiembro) {
    doAction(m.id, () => updateMiembroEstado(m.id, 'activo'));
  }

  async function handleRechazar(m: BatidaMiembro) {
    doAction(m.id, () => expulsarMiembro(m.id));
  }

  async function handleSilenciar(m: BatidaMiembro) {
    doAction(m.id, () => updateMiembroSilenciado(m.id, !m.silenciado));
  }

  async function handleExpulsar(m: BatidaMiembro) {
    doAction(m.id, () => expulsarMiembro(m.id));
  }

  async function handlePromover(m: BatidaMiembro) {
    doAction(m.id, () => promoverAdmin(batida.id, m.user_id));
  }

  function handleExitOnly() {
    onLeave();
  }

  async function handleLeaveDefinitive() {
    if (!user) return;
    const confirmed = confirm('¿Salir definitivamente de esta batida? Dejarás de aparecer como participante activo.');
    if (!confirmed) return;

    setLoading('leave-definitive');
    try {
      const miembro = miMiembro ?? await getMiBatidaMiembro(batida.id, user.id);
      // Salida definitiva: marcar abandonado para salir de la batida activa.
      if (miembro) {
        await updateMiembroEstado(miembro.id, 'abandonado');
      } else {
        await removeUserFromBatida(batida.id, user.id);
      }
      onLeave();
    } catch (err) {
      console.error('Error al salir de la batida:', err);
      alert('No se pudo salir definitivamente de la batida. Intenta de nuevo.');
    } finally {
      setLoading(null);
    }
  }

  async function handleSaveName() {
    if (!user || !nuevoNombre.trim()) return;
    setSavingName(true);
    try {
      await upsertPerfil(user.id, { nombre_completo: nuevoNombre.trim() });
      await refreshPerfil();
      setEditingName(false);
    } catch (err) {
      console.error('Error al guardar nombre:', err);
      alert('No se pudo guardar el nombre. Intenta de nuevo.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleFinalizar() {
    setLoading('finalizar');
    try {
      await finalizarBatida(batida.id);
      onLeave();
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-6">
      {/* Header with back */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onBack} className="text-amber hover:text-amber-light transition-colors p-2 -ml-2 rounded-lg hover:bg-forest-hover">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="text-white font-black text-xl">ℹ️ Info de la batida</h2>
      </div>

      {/* Compartir batida */}
      <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-amber/40 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Share2 className="w-5 h-5 text-amber" />
          <h3 className="text-white font-black text-base">🔗 Compartir batida</h3>
        </div>
        <div className="flex items-center gap-3 bg-forest border-2 border-forest-border rounded-xl px-4 py-3">
          <span className="text-forest-muted text-xs font-medium">Código:</span>
          <span className="text-amber font-black text-lg tracking-widest flex-1">{batida.codigo_invitacion}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleCopyCode}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-forest border-2 border-amber/50 hover:border-amber text-amber font-black text-sm transition-all duration-200">
            {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copiado ✓' : 'Copiar'}
          </button>
          <button onClick={handleShareWhatsApp}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-700/90 hover:bg-green-600 text-white font-black text-sm transition-all duration-200 shadow-lg">
            <Share2 className="w-5 h-5" />
            WhatsApp
          </button>
        </div>
      </div>

      {/* Batida info */}
      <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-forest-border rounded-2xl p-5">
        <h2 className="text-white font-black text-xl mb-3">{batida.nombre}</h2>
        <div className="flex items-center gap-2.5 mb-4">
          <span className={`text-xs px-3.5 py-1.5 rounded-full font-black ${batida.estado === 'activa' ? 'bg-green-900/40 text-green-300 border-2 border-green-700/40' : 'bg-gray-800/40 text-gray-400 border-2 border-gray-700/40'}`}>
            {batida.estado === 'activa' ? '● Activa ahora' : '● Finalizada'}
          </span>
          {isAdmin && <span className="text-xs px-3.5 py-1.5 rounded-full bg-amber/20 text-amber font-black border-2 border-amber/40 flex items-center gap-1.5"><Shield className="w-4 h-4" /> Admin</span>}
        </div>
        <div className="bg-forest border-2 border-forest-border rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-forest-muted text-xs font-black mb-2">Nombre visible</p>
              {editingName ? (
                <input
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full bg-forest-dark border-2 border-amber rounded-lg focus:border-amber-light outline-none py-2 px-3 text-white font-bold text-base"
                />
              ) : (
                <p className="text-white font-black text-lg">{perfil?.nombre_completo || 'Cazador'}</p>
              )}
            </div>
            {editingName ? (
              <div className="flex gap-2">
                <button onClick={() => { setEditingName(false); setNuevoNombre(perfil?.nombre_completo ?? ''); }}
                  className="text-forest-muted text-xs px-3.5 py-2.5 rounded-xl border-2 border-forest-border hover:text-white hover:border-amber/50 font-bold transition-all">
                  Cancelar
                </button>
                <button onClick={handleSaveName} disabled={savingName || !nuevoNombre.trim()}
                  className="text-xs px-3.5 py-2.5 rounded-xl bg-amber text-forest-dark font-black hover:bg-amber-light transition-all disabled:opacity-60">
                  {savingName ? '...' : 'Guardar'}
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingName(true)}
                className="text-xs px-3.5 py-2.5 rounded-xl border-2 border-forest-border text-amber hover:border-amber font-black transition-all">
                Cambiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pendientes (admin) */}
      {isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-amber font-black text-base flex items-center gap-2">
              <Users className="w-5 h-5" /> Solicitudes ({pendientes.length})
            </h3>
            <button onClick={onRefresh} className="text-forest-muted hover:text-amber text-xs px-3 py-2 rounded-lg font-bold">🔄</button>
          </div>
          {pendientes.length === 0 && <p className="text-forest-muted text-sm">Sin solicitudes pendientes</p>}
          <div className="space-y-2.5">
            {pendientes.map(m => (
              <div key={m.id} className="bg-gradient-to-r from-forest-dark to-forest-dark/70 border-2 border-amber/30 rounded-xl px-4 py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-base font-black truncate">{m.perfil?.nombre_completo || 'Cazador'}</p>
                  <p className="text-forest-muted text-xs font-medium mt-1">{m.tipo === 'perrero' ? '🐕 Perrero' : `🎯 Postura${m.puesto_nombre ? ' · ' + m.puesto_nombre : ''}`}</p>
                </div>
                <div className="flex gap-2.5">
                  <button onClick={() => handleAprobar(m)} disabled={loading === m.id}
                    className="bg-green-700/90 hover:bg-green-600 text-white p-2.5 rounded-lg transition-all flex items-center justify-center min-w-[44px] border-2 border-green-600/40">
                    {loading === m.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                  </button>
                  <button onClick={() => handleRechazar(m)} disabled={loading === m.id}
                    className="bg-red-800/90 hover:bg-red-700 text-white p-2.5 rounded-lg transition-all flex items-center justify-center min-w-[44px] border-2 border-red-700/40">
                    {loading === m.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserX className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Miembros activos */}
      <div>
        <h3 className="text-amber font-black text-base mb-4">
          👥 Participantes ({activos.length})
        </h3>
        {activos.length === 0 && <p className="text-forest-muted text-sm">Sin participantes activos</p>}
        <div className="space-y-2.5">
          {activos.map(m => {
            const esAdmin = adminIds.has(m.user_id);
            const esMi = m.user_id === user?.id;
            return (
              <div key={m.id} className={`bg-gradient-to-r from-forest-dark to-forest-dark/70 border-2 rounded-xl px-4 py-3.5 flex items-center gap-3 transition-all ${esAdmin ? 'border-amber/40' : 'border-forest-border'}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber to-amber-light flex items-center justify-center text-forest-dark font-black text-sm shadow-lg">
                  {(m.perfil?.nombre_completo || 'M')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="text-white text-base font-black truncate">{m.perfil?.nombre_completo || 'Cazador'}{esMi ? ' (Tú)' : ''}</p>
                    {esAdmin && <Shield className="w-4 h-4 text-amber shrink-0" />}
                    {m.silenciado && <VolumeX className="w-4 h-4 text-red-400 shrink-0" />}
                  </div>
                  <p className="text-forest-muted text-xs font-medium mt-1">{m.tipo === 'perrero' ? '🐕 Perrero' : `🎯 Postura${m.puesto_nombre ? ' · ' + m.puesto_nombre : ''}`}</p>
                </div>

                {isAdmin && !esMi && (
                  <div className="flex gap-1.5">
                    <button onClick={() => handleSilenciar(m)} disabled={loading === m.id} title={m.silenciado ? 'Dessilenciar' : 'Silenciar'}
                      className={`p-2 rounded-lg transition-all border-2 ${m.silenciado ? 'bg-amber/20 border-amber/40 text-amber' : 'bg-forest border-forest-border text-forest-muted hover:border-amber/60 hover:text-amber'}`}>
                      {m.silenciado ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                    {!esAdmin && (
                      <button onClick={() => handlePromover(m)} disabled={loading === m.id} title="Promover a admin"
                        className="p-2 rounded-lg bg-forest border-2 border-forest-border text-forest-muted hover:border-amber/60 hover:text-amber transition-all">
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleExpulsar(m)} disabled={loading === m.id} title="Expulsar"
                      className="p-2 rounded-lg bg-forest border-2 border-forest-border text-forest-muted hover:border-red-600/60 hover:text-red-400 transition-all flex items-center justify-center">
                      {loading === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Acciones peligrosas */}
      <div className="space-y-3 pt-2">
        {isAdmin && batida.estado === 'activa' && (
          <>
            {!confirmFinalizar ? (
              <button onClick={() => setConfirmFinalizar(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-red-600/60 text-red-400 hover:text-red-300 hover:border-red-500 rounded-2xl hover:bg-red-900/20 transition-all text-base font-black">
                <Flag className="w-5 h-5" />
                Finalizar batida
              </button>
            ) : (
              <div className="bg-red-900/20 border-2 border-red-700/60 rounded-2xl p-5 space-y-4">
                <p className="text-red-300 text-base text-center font-black">¿Finalizar la batida?</p>
                <p className="text-red-400/70 text-xs text-center font-medium">Esta acción no se puede deshacer</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmFinalizar(false)} className="flex-1 py-3 rounded-xl border-2 border-forest-border text-amber font-black text-sm transition-all hover:border-amber">Cancelar</button>
                  <button onClick={handleFinalizar} disabled={loading === 'finalizar'}
                    className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-black text-sm flex items-center justify-center gap-2 border-2 border-red-600/40 transition-all disabled:opacity-60">
                    {loading === 'finalizar' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Finalizar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        <button onClick={handleExitOnly} disabled={loading === 'leave-definitive' || loading === 'finalizar'}
          className="w-full flex items-center justify-center gap-2 py-3.5 text-amber hover:text-amber-light text-base font-black transition-all border-2 border-transparent hover:border-amber/40 rounded-xl disabled:opacity-60">
          <LogOut className="w-5 h-5" />
          Salir sin abandonar
        </button>
        <button onClick={handleLeaveDefinitive} disabled={loading === 'leave-definitive' || loading === 'finalizar'}
          className="w-full flex items-center justify-center gap-2 py-3.5 text-red-400 hover:text-red-300 text-base font-black transition-all border-2 border-red-700/30 hover:border-red-600/60 rounded-xl disabled:opacity-60">
          {loading === 'leave-definitive' ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
          Salir definitivamente
        </button>
      </div>
    </div>
  );
}