import { X } from 'lucide-react';
import { Dog, Crosshair, HeartPulse, Bell, ChevronRight, AlertTriangle } from 'lucide-react';
import type { Perro, Salud } from '../lib/types';
import type { AppConfig } from '../App';

interface Props {
  perros: Perro[];
  alertas: Salud[];
  onNavigate: (s: string) => void;
  config: AppConfig;
  notifVistas: Set<string>;
  onDismiss: (s: Salud) => void;
}

function calcEdad(fecha: string | null): string {
  if (!fecha) return '';
  const hoy = new Date();
  const nac = new Date(fecha);
  let anos = hoy.getFullYear() - nac.getFullYear();
  let meses = hoy.getMonth() - nac.getMonth();
  let dias = hoy.getDate() - nac.getDate();
  if (dias < 0) { meses--; dias += 30; }
  if (meses < 0) { anos--; meses += 12; }
  if (anos > 0) return `${anos}a ${meses}m`;
  if (meses > 0) return `${meses}m ${dias}d`;
  return `${dias}d`;
}

export default function InicioSection({ perros, alertas, onNavigate, notifVistas, onDismiss }: Props) {
  const hoy = new Date();
  const diasAlerta = alertas.map(a => {
    const diff = Math.ceil((new Date(a.fecha_proximo!).getTime() - hoy.getTime()) / 86400000);
    return { ...a, diasRestantes: diff };
  }).sort((a, b) => a.diasRestantes - b.diasRestantes);

  const alertasNoVistas = diasAlerta.filter(a => !notifVistas.has(`${a.id}_${a.fecha_proximo}`));

  return (
    <div className="p-4 space-y-4">
      {/* Banner */}
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center mb-3">
          <img
            src="/icon.png"
            className="w-32 h-auto drop-shadow-lg"
            alt="logo"
          />
        </div>
        <h1 className="text-amber-300 text-2xl font-bold tracking-wide">Mi Registro de Caza</h1>
        <p className="text-amber-600 text-xs mt-1">V4.0 Completa</p>
      </div>

      {/* Alertas salud */}
      {alertasNoVistas.length > 0 && (
        <div className="bg-red-900/30 border border-red-600/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-red-400 animate-pulse" />
            <span className="text-red-300 font-semibold text-sm">Avisos de Salud</span>
            <span className="ml-auto text-red-500 text-xs">{alertasNoVistas.length} pendiente{alertasNoVistas.length > 1 ? 's' : ''}</span>
          </div>
          {alertasNoVistas.map(a => (
            <div
              key={a.id}
              className="flex items-center gap-2 bg-red-950/40 rounded-lg px-3 py-2"
            >
              <button
                className="flex-1 text-left"
                onClick={() => onNavigate('salud')}
              >
                <div className="text-red-200 text-sm font-medium">{(a as any).perro?.nombre || 'Perro'}</div>
                <div className="text-red-400 text-xs">{a.tipo} · {new Date(a.fecha_proximo!).toLocaleDateString('es-ES')}</div>
              </button>
              <div className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                a.diasRestantes < 0 ? 'bg-red-700 text-white' :
                a.diasRestantes === 0 ? 'bg-orange-600 text-white' :
                'bg-yellow-700/60 text-yellow-200'
              }`}>
                {a.diasRestantes < 0 ? `${Math.abs(a.diasRestantes)}d vencido` :
                 a.diasRestantes === 0 ? 'Hoy' :
                 `${a.diasRestantes}d`}
              </div>
              <button
                onClick={() => onDismiss(a)}
                className="flex-shrink-0 text-red-600 hover:text-red-300 p-1 rounded-full hover:bg-red-900/40 transition-colors"
                title="Marcar como visto"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mis perros */}
      <div className="bg-black/30 border border-amber-700/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Dog size={16} className="text-amber-500" />
            <span className="text-amber-300 font-semibold text-sm">Mis Perros</span>
          </div>
          <button onClick={() => onNavigate('perros')} className="text-amber-600 hover:text-amber-400 flex items-center gap-1 text-xs">
            Ver todos <ChevronRight size={14} />
          </button>
        </div>
        {perros.length === 0 ? (
          <p className="text-amber-700 text-sm text-center py-2">No hay perros registrados</p>
        ) : (
          <div className="space-y-2">
            {perros.slice(0, 4).map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
                {p.foto ? (
                  <img src={p.foto} className="w-10 h-10 rounded-full object-cover border border-amber-700/40" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
                    <Dog size={18} className="text-amber-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-amber-200 text-sm font-medium truncate">{p.nombre}</div>
                  <div className="text-amber-600 text-xs">{p.raza}{p.fecha_nacimiento ? ` · ${calcEdad(p.fecha_nacimiento)}` : ''}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  p.sexo === 'macho' ? 'border-blue-600/40 text-blue-300 bg-blue-900/20' : 'border-pink-600/40 text-pink-300 bg-pink-900/20'
                }`}>{p.sexo === 'macho' ? '♂' : '♀'}</span>
              </div>
            ))}
            {perros.length > 4 && (
              <p className="text-amber-600 text-xs text-center">+{perros.length - 4} más...</p>
            )}
          </div>
        )}
      </div>

      {/* Acceso rápido */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'cacerias', label: 'Cacerías', icon: <Crosshair size={20} className="text-amber-400" />, color: 'border-amber-700/30' },
          { id: 'salud', label: 'Salud', icon: <HeartPulse size={20} className="text-green-400" />, color: 'border-green-700/30', badge: alertasNoVistas.length },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`bg-black/30 border ${item.color} rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-black/50 transition-colors relative`}
          >
            {item.icon}
            <span className="text-amber-300 text-sm font-medium">{item.label}</span>
            {item.badge ? (
              <span className="absolute top-2 right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Info */}
      {alertas.length === 0 && perros.length === 0 && (
        <div className="bg-amber-900/10 border border-amber-700/20 rounded-xl p-5 text-center">
          <AlertTriangle size={24} className="text-amber-600 mx-auto mb-2" />
          <p className="text-amber-400 text-sm">Empieza añadiendo tus perros en la sección <strong>Perros</strong></p>
        </div>
      )}

      <div className="text-center text-amber-900/40 text-xs pb-2">
        Fecha: {hoy.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}
