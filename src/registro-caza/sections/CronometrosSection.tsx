import { useState, useEffect, useRef } from 'react';
import { Timer, Play, Square, Trash2, Plus } from 'lucide-react';
import { cronometrosDB } from '../lib/db';
import type { Perro, Cronometro } from '../lib/types';

interface Props {
  perros: Perro[];
  perreraId: string;
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function CronometrosSection({ perros, perreraId }: Props) {
  const [cronometros, setCronometros] = useState<Cronometro[]>([]);
  const [selectedPerro, setSelectedPerro] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notas, setNotas] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const load = async () => {
    try {
      const data = await cronometrosDB.listWithPerro(perreraId);
      setCronometros(data as Cronometro[]);
    } catch (error) {
      console.error('Error loading cronometros:', error);
    }
  };

  useEffect(() => {
    load();
  }, [perreraId]);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const start = () => { setElapsed(0); setRunning(true); };
  const stop = () => setRunning(false);

  const save = async () => {
    if (!selectedPerro || elapsed === 0) return;
    try {
      await cronometrosDB.insert(perreraId, {
        perro_id: selectedPerro,
        duracion_segundos: elapsed,
        fecha: new Date().toISOString().split('T')[0],
        notas: notas.trim()
      });
      setElapsed(0);
      setNotas('');
      await load();
    } catch (error) {
      console.error('Error saving cronometro:', error);
    }
  };

  const deleteCron = async (id: string) => {
    if (!confirm('¿Eliminar?')) return;
    try {
      await cronometrosDB.delete(id);
      await load();
    } catch (error) {
      console.error('Error deleting cronometro:', error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-amber-300 font-bold text-lg">Cronómetros</h2>

      {/* Cronómetro activo */}
      <div className="bg-black/40 border border-amber-700/30 rounded-2xl p-6 text-center space-y-4">
        <div className="text-6xl font-mono font-bold text-amber-300 tabular-nums">
          {formatTime(elapsed)}
        </div>

        {perros.length > 0 && (
          <select
            className="w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-500"
            value={selectedPerro}
            onChange={e => setSelectedPerro(e.target.value)}
            disabled={running}
          >
            <option value="">Seleccionar perro...</option>
            {perros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        )}

        <div className="flex gap-3 justify-center">
          {!running ? (
            <button onClick={start} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-medium transition-colors">
              <Play size={20} /> Iniciar
            </button>
          ) : (
            <button onClick={stop} className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-medium transition-colors">
              <Square size={20} /> Parar
            </button>
          )}
        </div>

        {!running && elapsed > 0 && selectedPerro && (
          <div className="space-y-2">
            <input
              className="w-full bg-black/40 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500"
              placeholder="Notas (opcional)"
              value={notas}
              onChange={e => setNotas(e.target.value)}
            />
            <button onClick={save} className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-medium transition-colors">
              <Plus size={16} /> Guardar cronómetro
            </button>
          </div>
        )}
      </div>

      {/* Histórico */}
      {cronometros.length > 0 && (
        <div className="space-y-2">
          <p className="text-amber-600 text-xs font-medium uppercase tracking-wider">Histórico</p>
          {cronometros.map(c => (
            <div key={c.id} className="bg-black/30 border border-amber-700/20 rounded-xl flex items-center gap-3 px-4 py-3">
              {(c as any).perro?.foto ? (
                <img src={(c as any).perro.foto} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-amber-900/20 border border-amber-700/30 flex items-center justify-center flex-shrink-0">
                  <Timer size={16} className="text-amber-700" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-amber-200 text-sm font-medium">{(c as any).perro?.nombre || 'Perro'}</div>
                <div className="text-amber-600 text-xs">{new Date(c.fecha).toLocaleDateString('es-ES')}</div>
                {c.notas && <div className="text-amber-700 text-xs truncate">{c.notas}</div>}
              </div>
              <div className="text-amber-300 font-mono font-bold text-base flex-shrink-0">{formatTime(c.duracion_segundos)}</div>
              <button onClick={() => deleteCron(c.id)} className="text-red-700 hover:text-red-400 flex-shrink-0 p-1"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {cronometros.length === 0 && !running && (
        <div className="text-center py-6 text-amber-700">
          <Timer size={40} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Inicia un cronómetro y guárdalo.</p>
        </div>
      )}
    </div>
  );
}
