import { useEffect, useState } from 'react';
import { Clock, LogOut, RefreshCw, Loader2 } from 'lucide-react';
import type { Batida, BatidaMiembro } from '../lib/types';
import { getMiBatidaMiembro, updateMiembroEstado } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Props {
  batida: Batida;
  onLeave: () => void;
  onApproved: () => void;
}

export default function EsperandoScreen({ batida, onLeave, onApproved }: Props) {
  const { user } = useAuth();
  const [miembro, setMiembro] = useState<BatidaMiembro | null>(null);
  const [checking, setChecking] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;

    getMiBatidaMiembro(batida.id, user.id).then((m) => {
      if (isMounted) setMiembro(m);
    });

    const channel = supabase
      .channel(`espera-${batida.id}-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'batida_miembros',
        filter: `batida_id=eq.${batida.id}`,
      }, (payload) => {
        const updated = payload.new as BatidaMiembro;
        if (updated.user_id === user.id && updated.estado === 'activo') {
          onApproved();
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [batida.id, user, onApproved]);

  async function handleCheck() {
    if (!user || checking || leaving) return;
    setChecking(true);
    try {
      const m = await getMiBatidaMiembro(batida.id, user.id);
      setMiembro(m);
      if (m?.estado === 'activo') {
        onApproved();
      }
    } catch (error) {
      console.error('Error al comprobar el estado:', error);
    } finally {
      setChecking(false);
    }
  }

  async function handleLeave() {
    if (!user || !miembro || leaving || checking) return;
    const confirmed = confirm('¿Cancelar solicitud definitivamente?');
    if (!confirmed) return;
    setLeaving(true);
    try {
      await updateMiembroEstado(miembro.id, 'abandonado');
      onLeave();
    } catch (error) {
      console.error('Error al cancelar la solicitud:', error);
      setLeaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-forest flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 bg-amber/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Clock className="w-10 h-10 text-amber" />
      </div>
      <h2 className="text-white text-2xl font-bold mb-2">Esperando aprobación</h2>
      <p className="text-forest-muted text-sm mb-1">Has solicitado unirte a</p>
      <p className="text-amber font-semibold text-lg mb-6">{batida.nombre}</p>
      <p className="text-forest-muted text-sm max-w-xs mb-10">
        El administrador de la batida debe aprobar tu solicitud. Se te avisará automáticamente cuando seas aceptado.
      </p>

      <div className="space-y-3 w-full max-w-xs">
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking || leaving}
          className="w-full bg-surface border border-forest-border text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:border-amber transition-colors disabled:opacity-60"
        >
          {checking ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {checking ? 'Comprobando...' : 'Comprobar estado'}
        </button>

        <button
          type="button"
          onClick={onLeave}
          disabled={leaving || checking}
          className="w-full text-amber hover:text-amber-light py-2 text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
        >
          <LogOut className="w-4 h-4" />
          Salir sin abandonar
        </button>
        
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaving || checking}
          className="w-full text-red-400 hover:text-red-300 py-2 text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
        >
          {leaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          Cancelar solicitud definitivamente
        </button>
      </div>
    </div>
  );
}