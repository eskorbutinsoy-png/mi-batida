import { useState } from 'react';
import { Info, Code2, Calendar, Tag, Archive } from 'lucide-react';
import CopiasSection from './CopiasSection';

interface Props {
  onRestore: () => void;
  perreraId?: string;
}

export default function InfoSection({ onRestore, perreraId }: Props) {
  const [tab, setTab] = useState<'info' | 'copias'>('info');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Info size={20} className="text-amber-500" />
        <h2 className="text-amber-300 font-bold text-lg">Info</h2>
      </div>

      <div className="flex gap-1 bg-black/30 rounded-xl p-1">
        <button
          onClick={() => setTab('info')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'info' ? 'bg-amber-700/60 text-amber-200' : 'text-amber-600 hover:text-amber-400'
          }`}
        >
          <Info size={15} />
          Información
        </button>
        <button
          onClick={() => setTab('copias')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'copias' ? 'bg-amber-700/60 text-amber-200' : 'text-amber-600 hover:text-amber-400'
          }`}
        >
          <Archive size={15} />
          Copias
        </button>
      </div>

      {tab === 'info' && (
        <div className="space-y-6">
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="flex justify-center mb-3">
              <img
                src="/icon.png"
                className="w-40 h-auto drop-shadow-lg"
                alt="logo"
              />
            </div>
            <h1 className="text-amber-200 font-bold text-2xl tracking-wide">Mi Registro de Caza</h1>
            <p className="text-amber-600 text-sm text-center max-w-xs">Gestión completa de cacerías, perros, salud y mucho más</p>
          </div>

          <div className="bg-black/30 border border-amber-700/20 rounded-2xl divide-y divide-amber-700/10 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <Tag size={18} className="text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-amber-600 text-xs uppercase tracking-wider mb-0.5">Versión</p>
                <p className="text-amber-100 font-semibold text-base">4.1</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <Calendar size={18} className="text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-amber-600 text-xs uppercase tracking-wider mb-0.5">Última actualización</p>
                <p className="text-amber-100 font-semibold text-base">29-06-2026</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-900/30 to-black/40 border border-amber-700/30 rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
            <Code2 size={28} className="text-amber-400" />
            <p className="text-amber-600 text-xs">Mi Registro de Caza · 2026</p>
            <p className="text-amber-500 text-xs font-medium">Aplicación creada y desarrollada por<br />Sergio Ibero Moreno</p>
          </div>
        </div>
      )}

      {tab === 'copias' && <CopiasSection onRestore={onRestore} perreraId={perreraId} />}
    </div>
  );
}
