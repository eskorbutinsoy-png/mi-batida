import { useState, useCallback, useEffect } from 'react';
import { BarChart2, TrendingUp, Dog, ChevronDown, ChevronUp } from 'lucide-react';
import { caceriasDB, caceriaAnimalesDB, caceriaPerrosDB, caceriaPerroEspeciesDB } from '../lib/db';
import type { Perro } from '../lib/types';

interface Stats {
  totalCacerias: number;
  totalCazados: number;
  totalMovidos: number;
  totalEscapados: number;
  porEspecie: Record<string, { cazados: number; movidos: number; escapados: number }>;
}

interface PerroStats {
  levantados: number;
  perseguidos: number;
  perdidos: number;
  muertes: number;
  participaciones: number;
  porEspecie: Record<string, { levantados: number; perseguidos: number; perdidos: number; muertes: number }>;
}

interface Props {
  perros: Perro[];
  perreraId: string;
}

export default function StatsSection({ perros, perreraId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [loading, setLoading] = useState(false);

  const [selectedPerro, setSelectedPerro] = useState<string>('');
  const [perroStats, setPerroStats] = useState<PerroStats | null>(null);
  const [loadingPerro, setLoadingPerro] = useState(false);
  const [showPerroStats, setShowPerroStats] = useState(false);

  const calcStats = useCallback(async () => {
    setLoading(true);
    try {
      let cacerias = await caceriasDB.list(perreraId);
      if (desde) cacerias = cacerias.filter(c => c.fecha >= desde);
      if (hasta) cacerias = cacerias.filter(c => c.fecha <= hasta);
      if (cacerias.length === 0) {
        setStats({ totalCacerias: 0, totalCazados: 0, totalMovidos: 0, totalEscapados: 0, porEspecie: {} });
        setLoading(false);
        return;
      }
      const ids = cacerias.map(c => c.id);
      const animales = await Promise.all(ids.map(id => caceriaAnimalesDB.listByCaceria(id)));
      const allAnimales = animales.flat();
      const porEspecie: Stats['porEspecie'] = {};
      let totalCazados = 0, totalMovidos = 0, totalEscapados = 0;
      allAnimales.forEach(a => {
        totalCazados += a.cazados;
        totalMovidos += a.movidos;
        totalEscapados += a.escapados;
        if (!porEspecie[a.especie]) porEspecie[a.especie] = { cazados: 0, movidos: 0, escapados: 0 };
        porEspecie[a.especie].cazados += a.cazados;
        porEspecie[a.especie].movidos += a.movidos;
        porEspecie[a.especie].escapados += a.escapados;
      });
      setStats({ totalCacerias: cacerias.length, totalCazados, totalMovidos, totalEscapados, porEspecie });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
    setLoading(false);
  }, [perreraId, desde, hasta]);

  const calcPerroStats = useCallback(async (perroId: string) => {
    if (!perroId) { setPerroStats(null); return; }
    setLoadingPerro(true);
    try {
      let caceriaIds: string[] | null = null;
      if (desde || hasta) {
        let cacs = await caceriasDB.list(perreraId);
        if (desde) cacs = cacs.filter(c => c.fecha >= desde);
        if (hasta) cacs = cacs.filter(c => c.fecha <= hasta);
        caceriaIds = cacs.map(c => c.id);
      }

      let data = await caceriaPerrosDB.listAll(perreraId);
      data = data.filter(cp => cp.perro_id === perroId);
      if (caceriaIds !== null) {
        if (caceriaIds.length === 0) {
          setPerroStats({ levantados: 0, perseguidos: 0, perdidos: 0, muertes: 0, participaciones: 0, porEspecie: {} });
          setLoadingPerro(false);
          return;
        }
        data = data.filter(cp => caceriaIds!.includes(cp.caceria_id));
      }

      if (data.length === 0) {
        setPerroStats({ levantados: 0, perseguidos: 0, perdidos: 0, muertes: 0, participaciones: 0, porEspecie: {} });
        setLoadingPerro(false);
        return;
      }

      const ps: PerroStats = { levantados: 0, perseguidos: 0, perdidos: 0, muertes: 0, participaciones: data.length, porEspecie: {} };
      data.forEach(r => {
        ps.levantados += r.levantados;
        ps.perseguidos += r.perseguidos;
        ps.perdidos += r.perdidos;
        ps.muertes += r.muertes;
      });

      const cpRowIds = data.map(r => r.id);
      if (cpRowIds.length > 0) {
        const especies = await caceriaPerroEspeciesDB.listByPerroIds(cpRowIds);
        especies.forEach((e: any) => {
          if (!ps.porEspecie[e.especie]) ps.porEspecie[e.especie] = { levantados: 0, perseguidos: 0, perdidos: 0, muertes: 0 };
          const campo = e.campo as keyof typeof ps.porEspecie[string];
          if (campo in ps.porEspecie[e.especie]) {
            (ps.porEspecie[e.especie] as any)[campo] += e.cantidad || 0;
          }
        });
      }

      setPerroStats(ps);
    } catch (error) {
      console.error('Error calculating perro stats:', error);
    }
    setLoadingPerro(false);
  }, [perreraId, desde, hasta]);

  useEffect(() => { calcStats(); }, [calcStats]);

  useEffect(() => {
    if (selectedPerro) calcPerroStats(selectedPerro);
  }, [selectedPerro, calcPerroStats]);

  const inputCls = "bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-500";

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-amber-300 font-bold text-lg">Estadísticas</h2>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-amber-600 text-xs mb-1 block">Desde</label>
          <input type="date" className={`w-full ${inputCls}`} value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="text-amber-600 text-xs mb-1 block">Hasta</label>
          <input type="date" className={`w-full ${inputCls}`} value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <button onClick={calcStats} disabled={loading} className="bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
          <TrendingUp size={16} /> {loading ? '...' : 'Calcular'}
        </button>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Cacerías', stats.totalCacerias, 'text-amber-400', 'border-amber-700/30'],
              ['Cazados', stats.totalCazados, 'text-green-400', 'border-green-700/30'],
              ['Movidos', stats.totalMovidos, 'text-blue-400', 'border-blue-700/30'],
              ['Escapados', stats.totalEscapados, 'text-red-400', 'border-red-700/30'],
            ].map(([label, val, cls, border]) => (
              <div key={label as string} className={`bg-black/30 border ${border} rounded-xl p-4 text-center`}>
                <div className={`text-3xl font-bold ${cls}`}>{val}</div>
                <div className="text-amber-600 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Por Especie */}
          {Object.keys(stats.porEspecie).length > 0 && (
            <div className="bg-black/30 border border-amber-700/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-amber-500" />
                <p className="text-amber-400 text-sm font-semibold">Por Especie</p>
              </div>
              <div className="space-y-4">
                {Object.entries(stats.porEspecie)
                  .sort((a, b) => b[1].cazados - a[1].cazados)
                  .map(([especie, d]) => {
                    const total = d.cazados + d.movidos + d.escapados;
                    return (
                      <div key={especie} className="bg-black/20 border border-amber-700/15 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-200 font-semibold text-sm">{especie}</span>
                          <span className="text-amber-600 text-xs">{total} total</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-green-900/25 border border-green-700/25 rounded-lg p-2 text-center">
                            <div className="text-green-400 font-bold text-lg leading-none">{d.cazados}</div>
                            <div className="text-green-700 text-xs mt-0.5">Cazados</div>
                          </div>
                          <div className="bg-blue-900/25 border border-blue-700/25 rounded-lg p-2 text-center">
                            <div className="text-blue-400 font-bold text-lg leading-none">{d.movidos}</div>
                            <div className="text-blue-700 text-xs mt-0.5">Movidos</div>
                          </div>
                          <div className="bg-red-900/25 border border-red-700/25 rounded-lg p-2 text-center">
                            <div className="text-red-400 font-bold text-lg leading-none">{d.escapados}</div>
                            <div className="text-red-700 text-xs mt-0.5">Escapados</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {stats.totalCacerias === 0 && (
            <div className="text-center py-8 text-amber-700">
              <BarChart2 size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay datos para el período seleccionado.</p>
            </div>
          )}
        </>
      )}

      {/* Stats por perro */}
      {perros.length > 0 && (
        <div className="bg-black/30 border border-amber-700/20 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPerroStats(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Dog size={16} className="text-amber-500" />
              <span className="text-amber-400 text-sm font-medium">Estadísticas por Perro</span>
            </div>
            {showPerroStats ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-amber-600" />}
          </button>

          {showPerroStats && (
            <div className="px-4 pb-4 space-y-4 border-t border-amber-700/20 pt-3">
              <div>
                <label className="text-amber-600 text-xs mb-1.5 block">Seleccionar perro</label>
                <select
                  className={`w-full ${inputCls}`}
                  value={selectedPerro}
                  onChange={e => setSelectedPerro(e.target.value)}
                >
                  <option value="">Elegir perro...</option>
                  {perros.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              {loadingPerro && (
                <div className="text-center py-4 text-amber-700 text-sm">Calculando...</div>
              )}

              {!loadingPerro && perroStats && selectedPerro && (
                <>
                  {/* Totales del perro */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Cacerías', perroStats.participaciones, 'text-amber-400', 'border-amber-700/25'],
                      ['Levantados', perroStats.levantados, 'text-green-400', 'border-green-700/25'],
                      ['Perseguidos', perroStats.perseguidos, 'text-blue-400', 'border-blue-700/25'],
                      ['Perdidos', perroStats.perdidos, 'text-orange-400', 'border-orange-700/25'],
                      ['Muertes', perroStats.muertes, 'text-red-400', 'border-red-700/25'],
                    ].map(([label, val, cls, border]) => (
                      <div key={label as string} className={`bg-black/40 border ${border} rounded-xl p-3 text-center`}>
                        <div className={`text-2xl font-bold ${cls}`}>{val}</div>
                        <div className="text-amber-700 text-xs mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Por especie del perro */}
                  {Object.keys(perroStats.porEspecie).length > 0 && (
                    <div className="space-y-3">
                      <p className="text-amber-500 text-xs font-semibold uppercase tracking-wider">Por especie</p>
                      {Object.entries(perroStats.porEspecie)
                        .sort((a, b) => b[1].levantados - a[1].levantados)
                        .map(([especie, d]) => (
                          <div key={especie} className="bg-black/20 border border-amber-700/15 rounded-xl p-3 space-y-2">
                            <span className="text-amber-200 font-semibold text-sm">{especie}</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-green-900/20 border border-green-700/20 rounded-lg p-2 text-center">
                                <div className="text-green-400 font-bold text-base leading-none">{d.levantados}</div>
                                <div className="text-green-700 text-xs mt-0.5">Levantados</div>
                              </div>
                              <div className="bg-blue-900/20 border border-blue-700/20 rounded-lg p-2 text-center">
                                <div className="text-blue-400 font-bold text-base leading-none">{d.perseguidos}</div>
                                <div className="text-blue-700 text-xs mt-0.5">Perseguidos</div>
                              </div>
                              <div className="bg-orange-900/20 border border-orange-700/20 rounded-lg p-2 text-center">
                                <div className="text-orange-400 font-bold text-base leading-none">{d.perdidos}</div>
                                <div className="text-orange-700 text-xs mt-0.5">Perdidos</div>
                              </div>
                              <div className="bg-red-900/20 border border-red-700/20 rounded-lg p-2 text-center">
                                <div className="text-red-400 font-bold text-base leading-none">{d.muertes}</div>
                                <div className="text-red-700 text-xs mt-0.5">Muertes</div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {perroStats.participaciones === 0 && (
                    <p className="text-amber-700 text-xs text-center">Sin registros para este perro en el período seleccionado.</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
