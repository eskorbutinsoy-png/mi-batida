import { useEffect, useState, useMemo, useCallback } from 'react';
import type {
  Batida,
  BatidaMiembro,
  BatidaRegistro,
  BatidaRastro,
  BatidaAlerta,
  BatidaMensaje,
  BatidaPuestoMapa,
  EspecieRegistro,
} from '../lib/types';
import { TIPO_REGISTRO_LABELS, ESPECIE_A_CUPO, getEspecieLabel, getEspecieEmoji, normalizeEspecieRegistro } from '../lib/types';
import { getRegistros, getRastros, getAlertasPerro, getMensajes, getPuestosMapa } from '../lib/db';
import { supabase } from '../lib/supabase';
import { BarChart3, Trophy, User, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  batida: Batida;
  miembros: BatidaMiembro[];
  onBack: () => void;
}

const TIPO_COLORS = { 
  cazado: 'text-green-400 bg-green-900/20', 
  escapado: 'text-gray-400 bg-gray-800/30', 
  herido: 'text-orange-400 bg-orange-900/20' 
};
const TIPO_BG = { 
  cazado: 'bg-green-900/40 border-green-700/50', 
  escapado: 'bg-gray-800/60 border-gray-700/50', 
  herido: 'bg-orange-900/40 border-orange-700/50' 
};

export default function TotalesSection({ batida, miembros, onBack }: Props) {
  const [registros, setRegistros] = useState<BatidaRegistro[]>([]);
  const [rastros, setRastros] = useState<BatidaRastro[]>([]);
  const [alertas, setAlertas] = useState<BatidaAlerta[]>([]);
  const [mensajes, setMensajes] = useState<BatidaMensaje[]>([]);
  const [puestos, setPuestos] = useState<BatidaPuestoMapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUids, setExpandedUids] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    const [r, ra, al, me, pu] = await Promise.all([
      getRegistros(batida.id),
      getRastros(batida.id),
      getAlertasPerro(batida.id),
      getMensajes(batida.id),
      getPuestosMapa(batida.id),
    ]);
    setRegistros(r);
    setRastros(ra);
    setAlertas(al);
    setMensajes(me);
    setPuestos(pu);
  }, [batida.id]);

  // Carga inicial y suscripción Realtime unificada
  useEffect(() => {
    loadAll().finally(() => setLoading(false));

    const ch = supabase.channel(`totales-${batida.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'batida_registros', 
        filter: `batida_id=eq.${batida.id}` 
      }, () => { getRegistros(batida.id).then(setRegistros); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'batida_rastros',
        filter: `batida_id=eq.${batida.id}`,
      }, () => { getRastros(batida.id).then(setRastros); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'batida_alertas',
        filter: `batida_id=eq.${batida.id}`,
      }, () => { getAlertasPerro(batida.id).then(setAlertas); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'batida_chat_mensajes',
        filter: `batida_id=eq.${batida.id}`,
      }, () => { getMensajes(batida.id).then(setMensajes); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'batida_puestos_mapa',
        filter: `batida_id=eq.${batida.id}`,
      }, () => { getPuestosMapa(batida.id).then(setPuestos); })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [batida.id, loadAll]);

  function toggleExpand(uid: string) {
    setExpandedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  // Memorizar mapas e índices estáticos
  const memberMap = useMemo(() => new Map(miembros.map(m => [m.user_id, m])), [miembros]);

  const timelineRows = useMemo(() => {
    const rows: Array<{ id: string; ts: number; hhmm: string; tipo: string; actor: string; detalle: string }> = [];

    registros.forEach((r) => {
      const m = memberMap.get(r.user_id);
      const actor = m?.perfil?.nombre_completo || 'Desconocido';
      rows.push({
        id: `reg-${r.id}`,
        ts: new Date(r.created_at).getTime(),
        hhmm: new Date(r.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'REGISTRO',
        actor,
        detalle: `${TIPO_REGISTRO_LABELS[r.tipo_registro]} · ${getEspecieLabel(r.especie)}${r.raza ? ` · ${r.raza}` : ''}${r.notas ? ` · ${r.notas}` : ''}`,
      });
    });

    mensajes
      .filter((msg) => typeof msg.mensaje === 'string' && msg.mensaje.includes('SOS DE SEGURIDAD'))
      .forEach((msg) => {
        const m = memberMap.get(msg.user_id);
        const actor = msg.perfil?.nombre_completo || m?.perfil?.nombre_completo || 'Desconocido';
        rows.push({
          id: `sos-${msg.id}`,
          ts: new Date(msg.created_at).getTime(),
          hhmm: new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          tipo: 'SOS',
          actor,
          detalle: (msg.mensaje || '').replace(/\n/g, ' · ').slice(0, 220),
        });
      });

    alertas.forEach((a) => {
      const m = memberMap.get(a.user_id);
      const actor = a.perfil?.nombre_completo || m?.perfil?.nombre_completo || 'Desconocido';
      rows.push({
        id: `alt-${a.id}`,
        ts: new Date(a.created_at).getTime(),
        hhmm: new Date(a.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'ALERTA',
        actor,
        detalle: `${a.tipo_alerta}${a.raza ? ` · ${a.raza}` : ''}${a.color ? ` · ${a.color}` : ''}${a.direccion ? ` · ${a.direccion}` : ''}${a.mensaje ? ` · ${a.mensaje}` : ''}`,
      });
    });

    rastros.forEach((r) => {
      const m = memberMap.get(r.user_id);
      const actor = m?.perfil?.nombre_completo || 'Desconocido';
      rows.push({
        id: `ras-${r.id}`,
        ts: new Date(r.created_at).getTime(),
        hhmm: new Date(r.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'RASTRO',
        actor,
        detalle: `${r.especie} · ${r.antiguedad} · dir ${r.direccion}`,
      });
    });

    puestos.forEach((p) => {
      rows.push({
        id: `pue-${p.id}`,
        ts: new Date(p.created_at).getTime(),
        hhmm: new Date(p.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'PUESTO',
        actor: 'Sistema',
        detalle: `${p.nombre} · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
      });
    });

    return rows.sort((a, b) => b.ts - a.ts);
  }, [registros, mensajes, alertas, rastros, puestos, memberMap]);

  // Filtrar cazados de forma eficiente
  const cazados = useMemo(() => registros.filter(r => r.tipo_registro === 'cazado'), [registros]);

  // Conteo total por especie memorizado
  const conteo = useMemo(() => {
    const counts: Record<string, number> = {};
    cazados.forEach(r => {
      const key = normalizeEspecieRegistro(r.especie);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [cazados]);

  // Evaluar especies con cupo activo (predefinidas + custom)
  const especiesConCupo = useMemo(() => {
    const fixed = (Object.entries(ESPECIE_A_CUPO) as [EspecieRegistro, keyof Batida][])
      .filter(([esp]) => esp !== 'jabali')
      .filter(([, cupoKey]) => (batida[cupoKey] as number) > 0)
      .map(([esp, cupoKey]) => ({ especie: esp as string, cupoMax: batida[cupoKey] as number }));
    const custom = Object.entries(batida.cupos_custom || {})
      .filter(([, v]) => v > 0)
      .map(([esp, cupoMax]) => ({ especie: esp, cupoMax }));
    return [...fixed, ...custom];
  }, [batida]);

  // Agrupamiento y procesamiento avanzado por participante (Optimizado)
  const porParticipante = useMemo(() => {
    const list: Record<string, {
      nombre: string;
      puesto: string;
      cazados: number; escapados: number; heridos: number;
      porEspecie: Record<EspecieRegistro, { cazado: number; herido: number; escapado: number }>;
    }> = {};

    registros.forEach(r => {
      if (!list[r.user_id]) {
        const m = memberMap.get(r.user_id);
        list[r.user_id] = {
          nombre: m?.perfil?.nombre_completo || 'Desconocido',
          puesto: m ? (m.tipo === 'perrero' ? 'Perrero' : (`Postura${m.puesto_nombre ? ' · ' + m.puesto_nombre : ''}`)) : '',
          cazados: 0, escapados: 0, heridos: 0,
          porEspecie: {} as Record<EspecieRegistro, { cazado: number; herido: number; escapado: number }>,
        };
      }
      const p = list[r.user_id];
      if (r.tipo_registro === 'cazado') p.cazados++;
      else if (r.tipo_registro === 'escapado') p.escapados++;
      else p.heridos++;

      const especieKey = normalizeEspecieRegistro(r.especie) as EspecieRegistro;
      if (!p.porEspecie[especieKey]) p.porEspecie[especieKey] = { cazado: 0, herido: 0, escapado: 0 };
      p.porEspecie[especieKey][r.tipo_registro]++;
    });

    return Object.entries(list).sort(([, a], [, b]) => b.cazados - a.cazados);
  }, [registros, memberMap]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 text-amber animate-spin" />
    </div>
  );

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-forest-muted hover:text-amber transition-colors p-1 -ml-1">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber" />
          Resumen de la batida
        </h2>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-3 gap-3">
        {(['cazado', 'herido', 'escapado'] as const).map(tipo => (
          <div key={tipo} className="bg-surface border border-forest-border rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${TIPO_COLORS[tipo]}`}>
              {registros.filter(r => r.tipo_registro === tipo).length}
            </p>
            <p className="text-forest-muted text-xs mt-0.5">{TIPO_REGISTRO_LABELS[tipo]}</p>
          </div>
        ))}
      </div>

      {/* Cupos por especie */}
      {especiesConCupo.length > 0 && (
        <div>
          <h3 className="text-forest-light font-semibold text-sm mb-3">Cupos por especie</h3>
          <div className="space-y-3">
            {especiesConCupo.map(({ especie, cupoMax }) => {
              const usado = conteo[especie] || 0;
              const pct = cupoMax > 0 ? Math.min((usado / cupoMax) * 100, 100) : 0;
              const full = usado >= cupoMax;
              return (
                <div key={especie} className="bg-surface border border-forest-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">{getEspecieEmoji(especie)} {getEspecieLabel(especie)}</span>
                    <span className={`text-sm font-bold ${full ? 'text-red-400' : 'text-amber'}`}>
                      {usado}/{cupoMax}
                    </span>
                  </div>
                  <div className="h-2 bg-forest-dark rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : 'bg-amber'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Total cazado */}
      {cazados.length > 0 && (
        <div>
          <h3 className="text-forest-light font-semibold text-sm mb-3">Total cazado</h3>
          <div className="space-y-2">
            {Object.entries(conteo)
              .filter(([, n]) => n > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([esp, n]) => (
                <div key={esp} className="flex items-center justify-between bg-surface border border-forest-border rounded-xl px-4 py-2.5">
                  <span className="text-white text-sm">{getEspecieEmoji(esp)} {getEspecieLabel(esp)}</span>
                  <span className="text-green-400 font-bold text-lg">{n}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Por participante */}
      {porParticipante.length > 0 && (
        <div>
          <h3 className="text-forest-light font-semibold text-sm mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Por participante
          </h3>
          <div className="space-y-2">
            {porParticipante.map(([uid, data]) => {
              const expanded = expandedUids.has(uid);
              const especiesEntries = Object.entries(data.porEspecie) as [EspecieRegistro, { cazado: number; herido: number; escapado: number }][];
              return (
                <div key={uid} className="bg-surface border border-forest-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleExpand(uid)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-forest-hover transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-semibold truncate">{data.nombre}</span>
                        {data.cazados > 0 && <Trophy className="w-3.5 h-3.5 text-amber shrink-0" />}
                      </div>
                      <p className="text-forest-muted text-xs">{data.puesto}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex gap-2 text-xs font-semibold">
                        {data.cazados > 0 && <span className="text-green-400">{data.cazados} caz.</span>}
                        {data.heridos > 0 && <span className="text-orange-400">{data.heridos} her.</span>}
                        {data.escapados > 0 && <span className="text-gray-400">{data.escapados} esc.</span>}
                      </div>
                      {expanded
                        ? <ChevronUp className="w-4 h-4 text-forest-muted" />
                        : <ChevronDown className="w-4 h-4 text-forest-muted" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-forest-border divide-y divide-forest-border/50">
                      {especiesEntries.map(([esp, cnt]) => (
                        <div key={esp} className="px-4 py-2.5 flex items-center gap-3">
                          <span className="text-base w-5 text-center">{getEspecieEmoji(esp)}</span>
                          <span className="text-forest-light text-xs flex-1">{getEspecieLabel(esp)}</span>
                          <div className="flex gap-1.5">
                            {cnt.cazado > 0 && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIPO_BG.cazado} ${TIPO_COLORS.cazado}`}>
                                {cnt.cazado} caz.
                              </span>
                            )}
                            {cnt.herido > 0 && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIPO_BG.herido} ${TIPO_COLORS.herido}`}>
                                {cnt.herido} her.
                              </span>
                            )}
                            {cnt.escapado > 0 && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIPO_BG.escapado} ${TIPO_COLORS.escapado}`}>
                                {cnt.escapado} esc.
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transcripcion historica unificada en vivo */}
      <div>
        <h3 className="text-forest-light font-semibold text-sm mb-3">Transcripcion en vivo (hora:min)</h3>
        {timelineRows.length === 0 ? (
          <div className="bg-surface border border-forest-border rounded-xl p-4 text-forest-muted text-sm">Sin actividad todavia.</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {timelineRows.slice(0, 180).map((row) => (
              <div key={row.id} className="bg-surface border border-forest-border rounded-xl px-3 py-2.5 flex gap-3 items-start">
                <span className="text-amber text-xs font-black w-12 shrink-0">{row.hhmm}</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-forest-dark border border-forest-border text-forest-light shrink-0">{row.tipo}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-xs font-bold truncate">{row.actor}</p>
                  <p className="text-forest-muted text-xs leading-relaxed break-words">{row.detalle}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {registros.length === 0 && (
        <div className="text-center py-12 text-forest-muted">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Sin registros todavía</p>
        </div>
      )}
    </div>
  );
}