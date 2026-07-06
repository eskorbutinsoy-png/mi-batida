import { useState } from 'react';
import {
  Shield, Users, Clock, UserCheck, UserX, Trash2, Copy, Check,
  RefreshCw, MessageCircle, Dog
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { PerreraMiembro } from '../contexts/AuthContext';

export default function AdminPerreraSection() {
  const { perrera, miembros, user, nombreCompleto, approveMembers, rejectMembers, removeMember, reloadPerrera } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);


  const isAdmin = perrera?.admin_id === user?.id;
  if (!isAdmin || !perrera) return (
    <div className="p-8 text-center">
      <Shield size={40} className="mx-auto mb-3 text-amber-800 opacity-40" />
      <p className="text-amber-700 text-sm">Solo el administrador de la perrera tiene acceso a este panel.</p>
    </div>
  );

  const pendientes = miembros.filter(m => m.estado === 'pendiente');
  const aprobados = miembros.filter(m => m.estado === 'aprobado');

  const handleRefresh = async () => {
    setRefreshing(true);
    await reloadPerrera();
    setRefreshing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(perrera.codigo_invitacion).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enviarWhatsApp = () => {
    const msg = encodeURIComponent(
      `Te invito a unirte a la perrera *${perrera.nombre}* en Mi Registro de Caza.\n\nCódigo de invitación: *${perrera.codigo_invitacion}*\n\nDescarga la app o accede desde el navegador y usa este código para unirte.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const getInicial = (m: PerreraMiembro) =>
    (m.perfil?.nombre_completo ?? '?')[0]?.toUpperCase();

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Shield size={20} className="text-amber-500" />
        <h2 className="text-amber-300 font-bold text-lg">Administración de la Perrera</h2>
      </div>

      {/* Info de la perrera */}
      <div className="bg-black/30 border border-amber-700/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Dog size={16} className="text-amber-500" />
          <span className="text-amber-200 font-semibold text-sm">{perrera.nombre}</span>
          <span className="ml-auto text-xs bg-amber-700/40 text-amber-300 px-2 py-0.5 rounded-full">Admin</span>
        </div>

        {/* Código de invitación */}
        <div className="bg-black/20 rounded-xl p-3 space-y-2">
          <p className="text-amber-700 text-xs uppercase tracking-wider">Código de invitación</p>
          <div className="flex items-center gap-2">
            <span className="text-amber-200 font-mono font-bold text-lg tracking-widest flex-1">{perrera.codigo_invitacion}</span>
            <button
              onClick={handleCopy}
              className="p-2 text-amber-600 hover:text-amber-400 transition-colors"
              title="Copiar"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* Botón WhatsApp */}
        <button
          onClick={enviarWhatsApp}
          className="w-full flex items-center justify-center gap-2 bg-green-800/50 hover:bg-green-700/60 border border-green-700/40 text-green-300 py-3 rounded-xl text-sm font-semibold transition-colors"
        >
          <MessageCircle size={16} />
          Enviar invitación por WhatsApp
        </button>
      </div>

      {/* Solicitudes pendientes */}
      {pendientes.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-600/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-400" />
            <p className="text-amber-300 font-semibold text-sm">
              {pendientes.length} solicitud{pendientes.length > 1 ? 'es' : ''} pendiente{pendientes.length > 1 ? 's' : ''}
            </p>
          </div>
          {pendientes.map(m => (
            <div key={m.id} className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-800/40 flex items-center justify-center text-amber-300 font-bold text-sm flex-shrink-0">
                {getInicial(m)}
              </div>
              <span className="flex-1 text-amber-200 text-sm truncate">{m.perfil?.nombre_completo ?? 'Usuario'}</span>
              <button
                onClick={() => approveMembers([m.id])}
                className="p-2 bg-green-800/50 hover:bg-green-700/60 rounded-lg text-green-400 transition-colors"
                title="Aprobar"
              >
                <UserCheck size={15} />
              </button>
              <button
                onClick={() => rejectMembers([m.id])}
                className="p-2 bg-red-800/50 hover:bg-red-700/60 rounded-lg text-red-400 transition-colors"
                title="Rechazar"
              >
                <UserX size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Miembros activos */}
      <div className="bg-black/30 border border-amber-700/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-amber-500" />
            <p className="text-amber-300 font-semibold text-sm">
              Miembros ({aprobados.length + 1})
            </p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="text-amber-700 hover:text-amber-500 transition-colors p-1">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Admin (yo) */}
        <div className="flex items-center gap-3 bg-amber-700/10 border border-amber-700/20 rounded-xl px-3 py-2.5">
          <div className="w-9 h-9 rounded-full bg-amber-700/40 flex items-center justify-center text-amber-300 font-bold text-sm flex-shrink-0">
            {nombreCompleto[0]?.toUpperCase() ?? 'A'}
          </div>
          <span className="flex-1 text-amber-200 text-sm truncate">{nombreCompleto}</span>
          <span className="text-xs text-amber-500 bg-amber-900/40 px-2 py-0.5 rounded-full">Admin</span>
        </div>

        {aprobados.map(m => (
          <div key={m.id} className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-800/40 flex items-center justify-center text-amber-300 font-bold text-sm flex-shrink-0">
              {getInicial(m)}
            </div>
            <span className="flex-1 text-amber-200 text-sm truncate">{m.perfil?.nombre_completo ?? 'Miembro'}</span>
            <button
              onClick={() => {
                if (confirm(`¿Eliminar a ${m.perfil?.nombre_completo ?? 'este miembro'} de la perrera?`)) {
                  removeMember(m.id);
                }
              }}
              className="p-2 text-red-800 hover:text-red-400 transition-colors"
              title="Eliminar miembro"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {aprobados.length === 0 && (
          <p className="text-amber-800 text-xs text-center py-2">Solo el administrador por ahora</p>
        )}
      </div>

      {/* Zona de peligro */}
      <div className="bg-red-900/10 border border-red-700/20 rounded-2xl p-4 space-y-2">
        <p className="text-red-400 text-xs uppercase tracking-wider font-semibold">Información</p>
        <p className="text-amber-700 text-xs leading-relaxed">
          Al eliminar un miembro perderá el acceso a la perrera y a todos sus datos.
          Para volver a unirse necesitará el código de invitación y tu aprobación.
        </p>
      </div>
    </div>
  );
}
