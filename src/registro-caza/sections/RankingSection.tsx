import { useState, useCallback, useEffect } from 'react';
import { Trophy, Dog } from 'lucide-react';
import { caceriaPerrosDB, caceriaPerroEspeciesDB } from '../lib/db';
import type { Perro } from '../lib/types';

interface Props {
  perros: Perro[];
  perreraId: string;
}

const ESPECIES = ['Todas', 'Conejo', 'Liebre', 'Perdiz', 'Paloma', 'Codorniz', 'Jabalí', 'Ciervo', 'Corzo', 'Zorro'];
const TIPOS_RANK = ['levantados', 'perseguidos', 'perdidos', 'muertes'] as const;
type TipoRank = typeof TIPOS_RANK[number];

const TIPO_LABELS: Record<TipoRank, string> = {
  levantados: 'Levantados',
  perseguidos: 'Perseguidos',
  perdidos: 'Perdidos',
  muertes: 'Muertes',
};

interface RankEntry {
  perroId: string;
  nombre: string;
  foto: string;
  valor: number;
}

export default function RankingSection({ perros, perreraId }: Props) {
  const [especie, setEspecie] = useState('Todas');
  const [tipo, setTipo] = useState<TipoRank>('levantados');
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const calcRanking = useCallback(async () => {
    if (perros.length === 0) return;
    setLoading(true);
    try {
      const totales: Record<string, number> = {};

      if (especie === 'Todas') {
        const cpData = await caceriaPerrosDB.listAll(perreraId);
        cpData.forEach(cp => {
          if (!totales[cp.perro_id]) totales[cp.perro_id] = 0;
          totales[cp.perro_id] += (cp as any)[tipo] || 0;
        });
      } else {
        const allPerros = await caceriaPerrosDB.listAll(perreraId);
        const perroMap: Record<string, string> = {};
        allPerros.forEach(cp => { perroMap[cp.id] = cp.perro_id; });
        const allIds = allPerros.map(cp => cp.id);
        const especieData = await caceriaPerroEspeciesDB.listByPerroIds(allIds);
        especieData
          .filter((row: any) => row.especie === especie && row.campo === tipo)
          .forEach((row: any) => {
            const perroId = perroMap[row.caceria_perro_id];
            if (!perroId) return;
            if (!totales[perroId]) totales[perroId] = 0;
            totales[perroId] += row.cantidad || 0;
          });
      }

      const result: RankEntry[] = perros
        .map(p => ({ perroId: p.id, nombre: p.nombre, foto: p.foto || '', valor: totales[p.id] || 0 }))
        .filter(r => r.valor > 0)
        .sort((a, b) => b.valor - a.valor);

      setRanking(result);
    } catch (error) {
      console.error('Error calculating ranking:', error);
    }
    setLoading(false);
  }, [especie, tipo, perros, perreraId]);

  useEffect(() => { calcRanking(); }, [calcRanking]);

  const medalColors = [
    'bg-yellow-900/25 border-yellow-600/40',
    'bg-gray-800/30 border-gray-500/30',
    'bg-orange-900/20 border-orange-700/30',
  ];
  const valorColors = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];
  const medalIcons = ['1º', '2º', '3º'];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-amber-300 font-bold text-lg">Ranking de Perros</h2>

      {/* Selector de tipo */}
      <div>
        <label className="text-amber-600 text-xs mb-2 block uppercase tracking-wider">Tipo</label>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_RANK.map(t => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tipo === t
                  ? 'bg-amber-700 text-white shadow-lg'
                  : 'bg-black/30 text-amber-500 border border-amber-700/30 hover:border-amber-600/50'
              }`}
            >
              {TIPO_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de especie */}
      <div>
        <label className="text-amber-600 text-xs mb-2 block uppercase tracking-wider">Especie</label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ESPECIES.map(e => (
            <button
              key={e}
              onClick={() => setEspecie(e)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                especie === e
                  ? 'bg-amber-700 text-white shadow'
                  : 'bg-black/30 text-amber-500 border border-amber-700/30 hover:border-amber-600/50'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Indicador activo */}
      <div className="flex items-center gap-2 text-xs text-amber-600 bg-black/20 border border-amber-700/15 rounded-lg px-3 py-2">
        <Trophy size={12} className="text-amber-500" />
        <span>Mostrando <strong className="text-amber-400">{TIPO_LABELS[tipo]}</strong> · Especie: <strong className="text-amber-400">{especie}</strong></span>
        {loading && <span className="ml-auto animate-pulse">Calculando...</span>}
      </div>

      {/* Ranking */}
      {!loading && ranking.length === 0 ? (
        <div className="text-center py-12 text-amber-700">
          <Trophy size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay datos para esta combinación.</p>
          {especie !== 'Todas' && (
            <p className="text-xs mt-1 opacity-60">Comprueba que hay registros por especie en las cacerías.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((r, i) => (
            <div
              key={r.perroId}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                i < 3 ? medalColors[i] : 'bg-black/30 border-amber-700/20'
              }`}
            >
              {/* Posición */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                i === 0 ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-600/40' :
                i === 1 ? 'bg-gray-600/30 text-gray-300 border border-gray-500/40' :
                i === 2 ? 'bg-orange-700/30 text-orange-300 border border-orange-600/40' :
                'bg-black/30 text-amber-600 border border-amber-700/20'
              }`}>
                {i < 3 ? medalIcons[i] : `${i + 1}º`}
              </div>

              {/* Foto / icono */}
              {r.foto ? (
                <img src={r.foto} className="w-10 h-10 rounded-full object-cover border border-amber-700/40 flex-shrink-0" alt="" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-900/20 border border-amber-700/30 flex items-center justify-center flex-shrink-0">
                  <Dog size={18} className="text-amber-700" />
                </div>
              )}

              {/* Nombre y tipo */}
              <div className="flex-1 min-w-0">
                <div className="text-amber-200 font-semibold text-sm truncate">{r.nombre}</div>
                <div className="text-amber-700 text-xs">{TIPO_LABELS[tipo]}{especie !== 'Todas' ? ` · ${especie}` : ''}</div>
              </div>

              {/* Valor */}
              <div className={`text-2xl font-bold flex-shrink-0 ${i < 3 ? valorColors[i] : 'text-amber-400'}`}>
                {r.valor}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
