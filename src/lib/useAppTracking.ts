import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from './supabase';

export function useAppTracking(appName: 'Mi Batida' | 'Mi Registro de Caza') {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let sessionId: string | null = null;

    // Registrar inicio de sesión
    const startSession = async () => {
      try {
        const { data, error } = await supabase
          .from('app_sessions')
          .insert({
            user_id: user.id,
            app_name: appName,
            app_version: '1.2.24',
            platform: window.innerWidth < 768 ? 'mobile' : 'web',
            device_info: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
            },
          })
          .select('id')
          .single();

        if (error) throw error;
        sessionId = data.id;

        // Actualizar resumen de usuario
        await supabase.from('app_user_summary').upsert(
          {
            user_id: user.id,
            app_name: appName,
            last_session: new Date().toISOString(),
          },
          { onConflict: 'user_id,app_name' }
        );
      } catch (err) {
        console.error('Error starting session:', err);
      }
    };

    startSession();

    // Registrar cierre de sesión al desmontar
    return () => {
      if (sessionId) {
        supabase
          .from('app_sessions')
          .update({
            session_end: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .then(({ error }) => {
            if (error) console.error('Error ending session:', error);
          });
      }
    };
  }, [user, appName]);

  // Función para registrar eventos
  const trackEvent = async (
    eventType: string,
    eventData?: Record<string, any>
  ) => {
    if (!user) return;

    try {
      await supabase.from('app_events').insert({
        user_id: user.id,
        app_name: appName,
        event_type: eventType,
        event_data: eventData || {},
      });
    } catch (err) {
      console.error('Error tracking event:', err);
    }
  };

  return { trackEvent };
}
