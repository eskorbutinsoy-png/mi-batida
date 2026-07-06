import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Batida, BatidaMiembro, BatidaRegistro, EspecieRegistro, TipoRegistro } from '../lib/types';
import { ESPECIE_LABELS, TIPO_REGISTRO_LABELS, ESPECIE_EMOJIS, getEspecieLabel, getEspecieEmoji } from '../lib/types';
import { addRegistro, getRegistros, deleteRegistro } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import { Check, Loader2, FileText, ChevronDown, ChevronUp, Target, Wind, AlertTriangle, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  batida: Batida;
  miembros: BatidaMiembro[];
  isAdmin?: boolean;
  onBack: () => void;
}

const ESPECIES = (Object.entries(ESPECIE_LABELS) as [EspecieRegistro, string][])
  .filter(([k]) => k !== 'jabali');
const TIPOS = Object.entries(TIPO_REGISTRO_LABELS) as [TipoRegistro, string][];

const TIPO_COLORS: Record<TipoRegistro, string> = {
  cazado: 'bg-green-600 border-green-500 text-white',
  escapado: 'bg-gray-700 border-gray-600 text-white',
  herido: 'bg-orange-600 border-orange-500 text-white',
};
const TIPO_ACTIVE: Record<TipoRegistro, string> = {
  cazado: 'ring-2 ring-green-400 ring-offset-1 ring-offset-forest',
  escapado: 'ring-2 ring-gray-400 ring-offset-1 ring-offset-forest',
  herido: 'ring-2 ring-orange-400 ring-offset-1 ring-offset-forest',
};
const TIPO_ICONS: Record<TipoRegistro, typeof Target> = {
  cazado: Target,
  escapado: Wind,
  herido: AlertTriangle,
};
const TIPO_TEXT: Record<TipoRegistro, string> = {
  cazado: 'text-green-400',
  escapado: 'text-gray-400',
  herido: 'text-orange-400',
};

export default function RegistroSection({ batida, miembros, isAdmin, onBack }: Props) {
  const { user } = useAuth();
  const [especie, setEspecie] = useState<string>('jabali_macho');
  const [especieCustom, setEspecieCustom] = useState('');
  const [isCustomEspecie, setIsCustomEspecie] = useState(false);
  const [tipo, setTipo] = useState<TipoRegistro>('cazado');

  // Modal para registrar a otros (solo admin)
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTargetUid, setAdminTargetUid] = useState('');
  const [adminEspecie, setAdminEspecie] = useState<string>('jabali_macho');
  const [adminEspecieCustom, setAdminEspecieCustom] = useState('');
  const [adminIsCustomEspecie, setAdminIsCustomEspecie] = useState(false);
  const [adminTipo, setAdminTipo] = useState<TipoRegistro>('cazado');
  const [adminCantidad, setAdminCantidad] = useState(1);
  const [adminNotas, setAdminNotas] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState(false);

  const miembrosActivos = useMemo(() => miembros.filter(m => m.estado === 'activo' && m.user_id !== user?.id), [miembros, user]);

  async function handleAdminSubmit() {
    if (!adminTargetUid) return;
    const especieFinal = adminIsCustomEspecie ? adminEspecieCustom.trim() : adminEspecie;
    if (!especieFinal) return;
    setAdminLoading(true);
    try {
      for (let i = 0; i < adminCantidad; i++) {
        await addRegistro(batida.id, adminTargetUid, especieFinal as string, adminTipo, undefined, adminNotas || undefined);
      }
      // Esperar un poco para que Supabase sincronice
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadRegistros();
      setAdminSuccess(true);
      setTimeout(() => {
        setAdminSuccess(false);
        // Cerrar modal y resetear después del éxito
        setShowAdminModal(false);
        setAdminTargetUid('');
        setAdminEspecie('jabali_macho');
        setAdminEspecieCustom('');
        setAdminIsCustomEspecie(false);
        setAdminTipo('cazado');
        setAdminCantidad(1);
        setAdminNotas('');
      }, 1500);
    } catch (err) {
      console.error('Error al registrar para otro:', err);
      alert('Error al registrar. Intenta de nuevo.');
    } finally {
      setAdminLoading(false);
    }
  }

  // Especies custom definidas en los cupos de la batida
  const especiesCustomBatida = Object.keys(batida.cupos_custom || {});
  const autorizadas = batida.especies_autorizadas || [];
  const hayRestriccion = autorizadas.length > 0;

  // Función para saber si una especie está autorizada
  const esAutorizada = (key: string) => !hayRestriccion || autorizadas.includes(key);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registros, setRegistros] = useState<BatidaRegistro[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadRegistros = useCallback(() => {
    getRegistros(batida.id).then(setRegistros);
  }, [batida.id]);

  useEffect(() => { 
    loadRegistros(); 
  }, [loadRegistros]);

  // Suscripción Realtime limpia sin duplicación de canales
  useEffect(() => {
    const ch = supabase.channel(`registros-${batida.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'batida_registros', 
        filter: `batida_id=eq.${batida.id}` 
      }, () => loadRegistros())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [batida.id, loadRegistros]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const especieFinal = isCustomEspecie ? especieCustom.trim() : especie;
    if (!especieFinal) return;
    setLoading(true);
    try {
      await addRegistro(batida.id, user.id, especieFinal as EspecieRegistro, tipo, undefined, notas || undefined);
      loadRegistros();
      setSuccess(true);
      setNotas('');
      setTimeout(() => setSuccess(false), 3000);
    } catch { /* silently ignore */ }
    setLoading(false);
  }

  // Memorizar el mapeado de miembros para optimizar el rendimiento de la lista
  const memberMap = useMemo(() => new Map(miembros.map(m => [m.user_id, m])), [miembros]);

  // Agrupar por persona usando useMemo para evitar recálculos visuales molestos al abrir el historial
  const byPerson = useMemo(() => {
    const map = new Map<string, { nombre: string; puesto: string; entries: BatidaRegistro[] }>();
    for (const r of registros) {
      if (!map.has(r.user_id)) {
        const m = memberMap.get(r.user_id);
        map.set(r.user_id, {
          nombre: m?.perfil?.nombre_completo || 'Desconocido',
          puesto: m?.tipo === 'perrero' ? 'Perrero' : (`Postura${m?.puesto_nombre ? ' · ' + m.puesto_nombre : ''}`),
          entries: [],
        });
      }
      map.get(r.user_id)!.entries.push(r);
    }
    return map;
  }, [registros, memberMap]);

  // Mis propias estadísticas memorizadas
  const myCount = useMemo(() => {
    const cnt: Record<TipoRegistro, number> = { cazado: 0, escapado: 0, herido: 0 };
    const filtered = registros.filter(r => r.user_id === user?.id);
    for (const r of filtered) cnt[r.tipo_registro]++;
    return { cnt, total: filtered.length };
  }, [registros, user?.id]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-6">
      {/* Header with back */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onBack} className="text-amber hover:text-amber-light transition-colors p-2 -ml-2 rounded-lg hover:bg-forest-hover">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h2 className="text-white font-black text-xl leading-none">Registrar pieza</h2>
          <p className="text-forest-muted text-sm mt-1">Anota una pieza vista, cazada o herida</p>
        </div>
      </div>

      {/* My quick stats */}
      {myCount.total > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {(Object.keys(myCount.cnt) as TipoRegistro[]).map(t => {
            const Icon = TIPO_ICONS[t];
            return (
              <div key={t} className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-forest-border rounded-2xl px-3 py-3 text-center hover:border-forest-muted transition-all">
                <Icon className={`w-5 h-5 mx-auto mb-2 ${TIPO_TEXT[t]}`} />
                <p className="text-white font-black text-2xl leading-none">{myCount.cnt[t]}</p>
                <p className="text-forest-muted text-xs mt-1.5 font-medium">{TIPO_REGISTRO_LABELS[t]}</p>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Especie */}
        <div>
          <label className="block text-sm text-amber font-black mb-3.5">🎯 Especie</label>
          <div className="grid grid-cols-2 gap-3">
            {ESPECIES.map(([k, label]) => {
              const autorizada = esAutorizada(k);
              return (
                <button type="button" key={k} onClick={() => { if (!autorizada) return; setEspecie(k); setIsCustomEspecie(false); }}
                  className={`py-3.5 px-4 rounded-2xl border-2 text-sm font-bold transition-all text-left relative ${!isCustomEspecie && especie === k ? 'bg-gradient-to-br from-amber to-amber-light border-amber text-forest-dark shadow-lg' : autorizada ? 'bg-forest-dark border-forest-border text-white hover:border-amber/60 hover:bg-forest-hover' : 'bg-forest-dark border-red-900/30 text-forest-muted opacity-40 cursor-not-allowed'}`}>
                  <span className="text-lg">{ESPECIE_EMOJIS[k as EspecieRegistro]}</span> {label}
                  {!autorizada && <span className="absolute top-2 right-2 text-xs text-red-400 font-black">✕</span>}
                </button>
              );
            })}
            {/* Especies custom de la batida */}
            {especiesCustomBatida.map(esp => {
              const autorizada = esAutorizada(esp);
              return (
                <button type="button" key={esp} onClick={() => { if (!autorizada) return; setEspecie(esp); setIsCustomEspecie(false); }}
                  className={`py-3.5 px-4 rounded-2xl border-2 text-sm font-bold transition-all text-left relative ${!isCustomEspecie && especie === esp ? 'bg-gradient-to-br from-amber to-amber-light border-amber text-forest-dark shadow-lg' : autorizada ? 'bg-forest-dark border-amber/30 text-white hover:border-amber/60 hover:bg-forest-hover' : 'bg-forest-dark border-red-900/30 text-forest-muted opacity-40 cursor-not-allowed'}`}>
                  🎯 {esp}
                  {!autorizada && <span className="absolute top-2 right-2 text-xs text-red-400 font-black">✕</span>}
                </button>
              );
            })}
            {!hayRestriccion && (
              <button type="button" onClick={() => { setIsCustomEspecie(true); setEspecie(''); }}
                className={`py-3.5 px-4 rounded-2xl border-2 text-sm font-bold transition-all text-left flex items-center justify-center gap-2 ${isCustomEspecie ? 'bg-gradient-to-br from-amber to-amber-light border-amber text-forest-dark shadow-lg' : 'bg-forest-dark border-forest-border text-white hover:border-amber/60 hover:bg-forest-hover'}`}>
                <Plus className="w-5 h-5" /> Otra especie
              </button>
            )}
          </div>
          {hayRestriccion && (
            <p className="mt-3 text-xs text-orange-400 font-medium bg-orange-900/20 border border-orange-700/40 rounded-lg px-3 py-2">⚠️ Solo se muestran las especies autorizadas para esta batida</p>
          )}
          {isCustomEspecie && (
            <input
              value={especieCustom}
              onChange={e => setEspecieCustom(e.target.value)}
              placeholder="Nombre de la especie (ej: Gamo, Muflón...)"
              className="mt-3.5 w-full bg-forest-dark border-2 border-amber rounded-2xl px-4 py-3.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
              autoFocus
            />
          )}
        </div>

        {/* Resultado */}
        <div>
          <label className="block text-sm text-amber font-black mb-3.5">🎯 Resultado</label>
          <div className="flex gap-3">
            {TIPOS.map(([k, label]) => (
              <button type="button" key={k} onClick={() => setTipo(k)}
                className={`flex-1 py-4 rounded-2xl border-2 text-sm font-black transition-all duration-200 ${TIPO_COLORS[k]} ${tipo === k ? TIPO_ACTIVE[k] : 'opacity-50 border-forest-border/50'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm text-amber font-black mb-3">📝 Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Descripción, lugar, hora, comportamiento..."
            rows={3}
            className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200 resize-none"
          />
        </div>

        <button type="submit" disabled={loading || (isCustomEspecie && !especieCustom.trim())}
          className="w-full bg-gradient-to-r from-amber to-amber-light hover:from-amber-light hover:to-amber text-forest-dark font-black py-4 rounded-2xl transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-3 shadow-lg">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : success ? (
            <><Check className="w-5 h-5" /> Registrado</>
          ) : (
            <><FileText className="w-5 h-5" /> Registrar pieza</>
          )}
        </button>

        {/* Botón admin para registrar a otros */}
        {isAdmin && miembrosActivos.length > 0 && (
          <button type="button" onClick={() => setShowAdminModal(true)}
            className="w-full border-2 border-amber text-amber font-black py-3.5 rounded-2xl hover:bg-amber/10 transition-all duration-200 flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> Registrar para otro participante
          </button>
        )}
      </form>

      {/* History panel */}
      {registros.length > 0 && (
        <div className="border-2 border-forest-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-forest-dark to-forest-dark/70 hover:from-forest-hover hover:to-forest-dark transition-colors">
            <span className="text-white font-black text-base">📋 Piezas registradas ({registros.length})</span>
            {showHistory ? <ChevronUp className="w-5 h-5 text-amber" /> : <ChevronDown className="w-5 h-5 text-forest-muted" />}
          </button>

          {showHistory && (
            <div className="divide-y divide-forest-border/50 bg-forest-dark/30">
              {Array.from(byPerson.entries()).map(([uid, { nombre, puesto, entries }]) => {
                const cnt: Record<TipoRegistro, number> = { cazado: 0, escapado: 0, herido: 0 };
                for (const e of entries) cnt[e.tipo_registro]++;
                return (
                  <div key={uid} className="px-4 py-3.5 bg-forest-dark/50 border-b border-forest-border/30 last:border-b-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white text-base font-black">{nombre}</p>
                        <p className="text-forest-muted text-xs mt-0.5 font-medium">{puesto}</p>
                      </div>
                      <div className="flex gap-2.5 text-xs font-black">
                        {cnt.cazado > 0 && <span className="text-green-400 bg-green-900/20 border border-green-700/30 px-2.5 py-1.5 rounded-lg">{cnt.cazado} caz.</span>}
                        {cnt.herido > 0 && <span className="text-orange-400 bg-orange-900/20 border border-orange-700/30 px-2.5 py-1.5 rounded-lg">{cnt.herido} her.</span>}
                        {cnt.escapado > 0 && <span className="text-gray-400 bg-gray-900/20 border border-gray-700/30 px-2.5 py-1.5 rounded-lg">{cnt.escapado} esc.</span>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {entries.map(r => (
                        <div key={r.id} className="flex items-center gap-2.5 text-xs bg-forest-dark/70 px-3 py-2.5 rounded-lg border border-forest-border/30">
                          <span className="text-lg">{getEspecieEmoji(r.especie)}</span>
                          <span className="text-forest-light flex-1 font-medium">{getEspecieLabel(r.especie)}</span>
                          <span className={`font-black ${TIPO_TEXT[r.tipo_registro]}`}>{TIPO_REGISTRO_LABELS[r.tipo_registro]}</span>
                          {r.notas && <span className="text-forest-muted truncate max-w-[80px]" title={r.notas}>· {r.notas}</span>}
                          {r.user_id === user?.id && (
                            <button type="button" onClick={async () => { await deleteRegistro(r.id); loadRegistros(); }}
                              className="text-red-400 hover:text-red-300 ml-1 shrink-0 font-black" title="Eliminar">
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal admin: registrar para otro */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-gradient-to-br from-forest-dark to-forest-dark/90 rounded-t-3xl p-6 space-y-5 max-h-[85vh] overflow-y-auto border-t-2 border-amber">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-white font-black text-xl">📝 Registrar pieza</h3>
              <button onClick={() => setShowAdminModal(false)} className="text-amber hover:text-amber-light p-1"><span className="text-2xl">✕</span></button>
            </div>

            {/* Selector participante */}
            <div>
              <label className="block text-sm text-amber font-black mb-3">👤 Participante</label>
              <div className="space-y-2">
                {miembrosActivos.map(m => (
                  <button key={m.id} type="button" onClick={() => setAdminTargetUid(m.user_id)}
                    className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 text-sm font-bold transition-all ${adminTargetUid === m.user_id ? 'bg-gradient-to-r from-amber to-amber-light border-amber text-forest-dark shadow-lg' : 'bg-forest-dark border-forest-border text-white hover:border-amber/60 hover:bg-forest-hover'}`}>
                    {m.perfil?.nombre_completo || 'Cazador'} · {m.tipo === 'perrero' ? 'Perrero' : `Postura${m.puesto_nombre ? ' ' + m.puesto_nombre : ''}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Especie */}
            <div>
              <label className="block text-sm text-amber font-black mb-3">🎯 Especie</label>
              <div className="grid grid-cols-2 gap-2.5">
                {ESPECIES.map(([k, label]) => (
                  <button key={k} type="button" onClick={() => { setAdminEspecie(k); setAdminIsCustomEspecie(false); }}
                    className={`py-3 px-3 rounded-xl border-2 text-xs font-bold transition-all text-center ${!adminIsCustomEspecie && adminEspecie === k ? 'bg-amber border-amber text-forest-dark' : 'bg-forest-dark border-forest-border text-white hover:border-amber/60'}`}>
                    <span className="text-base">{ESPECIE_EMOJIS[k as EspecieRegistro]}</span><br/>{label}
                  </button>
                ))}
                {especiesCustomBatida.map(esp => (
                  <button key={esp} type="button" onClick={() => { setAdminEspecie(esp); setAdminIsCustomEspecie(false); }}
                    className={`py-3 px-3 rounded-xl border-2 text-xs font-bold transition-all text-center ${!adminIsCustomEspecie && adminEspecie === esp ? 'bg-amber border-amber text-forest-dark' : 'bg-forest-dark border-amber/30 text-white hover:border-amber/60'}`}>
                    🎯<br/>{esp}
                  </button>
                ))}
                <button type="button" onClick={() => { setAdminIsCustomEspecie(true); setAdminEspecie(''); }}
                  className={`py-3 px-3 rounded-xl border-2 text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${adminIsCustomEspecie ? 'bg-amber border-amber text-forest-dark' : 'bg-forest-dark border-forest-border text-white hover:border-amber/60'}`}>
                  <Plus className="w-4 h-4" /> Otra
                </button>
              </div>
              {adminIsCustomEspecie && (
                <input value={adminEspecieCustom} onChange={e => setAdminEspecieCustom(e.target.value)}
                  placeholder="Nombre especie..."
                  className="mt-3 w-full bg-forest-dark border-2 border-amber rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-amber-light transition-colors" autoFocus />
              )}
            </div>

            {/* Resultado */}
            <div>
              <label className="block text-sm text-amber font-black mb-3">✓ Resultado</label>
              <div className="flex gap-2.5">
                {TIPOS.map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setAdminTipo(k as TipoRegistro)}
                    className={`flex-1 py-3 rounded-xl border-2 text-xs font-bold transition-all ${TIPO_COLORS[k as TipoRegistro]} ${adminTipo === k ? TIPO_ACTIVE[k as TipoRegistro] : 'opacity-50 border-forest-border/50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm text-amber font-black mb-3">📊 Cantidad</label>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setAdminCantidad(c => Math.max(1, c - 1))}
                  className="w-12 h-12 rounded-xl bg-forest-dark border-2 border-forest-border hover:border-amber text-amber font-black text-xl flex items-center justify-center transition-colors">−</button>
                <span className="text-white font-black text-3xl w-10 text-center">{adminCantidad}</span>
                <button type="button" onClick={() => setAdminCantidad(c => Math.min(20, c + 1))}
                  className="w-12 h-12 rounded-xl bg-forest-dark border-2 border-forest-border hover:border-amber text-amber font-black text-xl flex items-center justify-center transition-colors">+</button>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm text-amber font-black mb-3">📝 Notas (opcional)</label>
              <input value={adminNotas} onChange={e => setAdminNotas(e.target.value)} placeholder="Observaciones..."
                className="w-full bg-forest-dark border-2 border-forest-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber transition-colors" />
            </div>

            <button type="button" onClick={handleAdminSubmit}
              disabled={adminLoading || !adminTargetUid || (adminIsCustomEspecie && !adminEspecieCustom.trim())}
              className="w-full bg-gradient-to-r from-amber to-amber-light text-forest-dark font-black py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg transition-all duration-200">
              {adminLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : adminSuccess ? <><Check className="w-5 h-5" /> Registrado</> : <><FileText className="w-5 h-5" /> Registrar {adminCantidad > 1 ? `(${adminCantidad})` : ''}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}