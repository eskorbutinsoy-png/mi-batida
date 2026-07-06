import { useEffect, useState, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthScreen from './screens/AuthScreen';
import BatidaScreen from './screens/BatidaScreen';
import EsperandoScreen from './screens/EsperandoScreen';
import MapaSection from './sections/MapaSection';
import RegistroSection from './sections/RegistroSection';
import TotalesSection from './sections/TotalesSection';
import ChatSection from './sections/ChatSection';
import BatidaInfoSection from './sections/BatidaInfoSection';
import AlertaPerrosSection from './sections/AlertaPerrosSection';
import PerfilSection from './sections/PerfilSection';
import type { Batida, BatidaMiembro, BatidaAdmin } from './lib/types';
import { getBatida, getBatidaMiembros, getBatidaAdmins, getMiBatidaMiembro, isAdmin, updateMiembroEstado, getMensajes, upsertPushDeviceToken } from './lib/db';
import { OFFLINE_QUEUE_UPDATED_EVENT, flushOfflineQueue, getOfflineQueueCount } from './lib/offlineQueue';
import { playSosAlarm, unlockSosAudio } from './lib/sosAlarm';
import { supabase } from './lib/supabase';
import { Map, FileText, BarChart3, MessageCircle, Info, Loader2, TreePine, Bell, UserCircle2 } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

type Tab = 'mapa' | 'registro' | 'totales' | 'chat' | 'batida' | 'alerta' | 'perfil';
const SOS_CHANNEL_ID = 'sos-alerts-v3';

function AppInner() {
  const { user, loading: authLoading } = useAuth();
  const [batida, setBatida] = useState<Batida | null>(null);
  const [miMiembro, setMiMiembro] = useState<BatidaMiembro | null>(null);
  const [miembros, setMiembros] = useState<BatidaMiembro[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [amAdmin, setAmAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>('mapa');
  const tabRef = useRef<Tab>('mapa');
  const [batidaLoading, setBatidaLoading] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [offlinePending, setOfflinePending] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const lastSeenMsgCount = useRef(0);
  const lastSeenBatidaId = useRef<string | null>(null);
  const appIsActiveRef = useRef(true);
  const lastSosNotifiedAtRef = useRef<string>('');

  async function notifyNativeSos(title: string, body: string) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title,
            body,
            channelId: SOS_CHANNEL_ID,
            smallIcon: 'ic_stat_icon_config_sample',
            sound: 'default',
            schedule: { at: new Date(Date.now() + 120) },
          },
        ],
      });
    } catch {
      // ignore: web or denied permission
    }
  }

  async function handleIncomingSosAlert(extraBody?: string) {
    playSosAlarm();
    const title = '🚨 SOS de seguridad';
    const body = extraBody || 'Se ha recibido una alerta SOS en tu batida.';
    await notifyNativeSos(title, body);
  }

  // Mantener tabRef sincronizado con tab
  useEffect(() => { tabRef.current = tab; }, [tab]);

  useEffect(() => {
    const unlock = () => { void unlockSosAudio(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    let removeStateListener: (() => void) | null = null;

    const initNotifications = async () => {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }

        await LocalNotifications.createChannel({
          id: SOS_CHANNEL_ID,
          name: 'Alertas SOS',
          description: 'Alertas sonoras críticas de seguridad',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
        });

        try {
          await PushNotifications.createChannel({
            id: SOS_CHANNEL_ID,
            name: 'Alertas SOS',
            description: 'Alertas SOS por push',
            importance: 5,
            visibility: 1,
            vibration: true,
          });
        } catch {
          // ignore if not available
        }
      } catch {
        // ignore in web or unsupported
      }

      try {
        const sub = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          appIsActiveRef.current = isActive;
        });
        removeStateListener = () => { void sub.remove(); };
      } catch {
        // ignore
      }
    };

    void initNotifications();

    return () => {
      if (removeStateListener) removeStateListener();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;

    let active = true;

    const initPush = async () => {
      try {
        const permStatus = await PushNotifications.checkPermissions();
        let receive = permStatus.receive;
        if (receive === 'prompt') {
          const req = await PushNotifications.requestPermissions();
          receive = req.receive;
        }
        if (receive !== 'granted') return;

        await PushNotifications.register();

        await PushNotifications.addListener('registration', (token) => {
          if (!active) return;
          const platform = Capacitor.getPlatform();
          const normalized = platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'web';
          void upsertPushDeviceToken(user.id, token.value, normalized);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          if (!active) return;
          const title = notification.title || '';
          const body = notification.body || '';
          const isSos = title.includes('SOS') || body.includes('SOS') || notification.data?.type === 'sos';
          if (isSos) {
            void handleIncomingSosAlert('Alerta SOS recibida por push.');
          }
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
          if (!active) return;
          const title = event.notification.title || '';
          const body = event.notification.body || '';
          const isSos = title.includes('SOS') || body.includes('SOS') || event.notification.data?.type === 'sos';
          if (isSos) {
            setTab('chat');
            void handleIncomingSosAlert('Has abierto una alerta SOS.');
          }
        });
      } catch {
        // ignore when push service is not fully configured yet
      }
    };

    void initPush();

    return () => {
      active = false;
      void PushNotifications.removeAllListeners().catch(() => undefined);
    };
  }, [user]);

  useEffect(() => {
    function extractInviteCode(urlText: string): string | null {
      try {
        const parsed = new URL(urlText);
        const queryCode = parsed.searchParams.get('code') || parsed.searchParams.get('invite');
        if (queryCode?.trim()) return queryCode.trim().toUpperCase();

        const pathMatch = parsed.pathname.match(/\/join\/?([A-Za-z0-9]{6,12})?/i);
        if (pathMatch?.[1]) return pathMatch[1].trim().toUpperCase();
      } catch {
        // ignore
      }
      return null;
    }

    let removeListener: (() => void) | null = null;

    const init = async () => {
      const webCode = extractInviteCode(window.location.href);
      if (webCode) {
        setPendingInviteCode(webCode);
      }

      try {
        const launch = await CapacitorApp.getLaunchUrl();
        const launchCode = launch?.url ? extractInviteCode(launch.url) : null;
        if (launchCode) {
          setPendingInviteCode(launchCode);
        }

        const sub = await CapacitorApp.addListener('appUrlOpen', ({ url }: { url: string }) => {
          const code = extractInviteCode(url);
          if (code) setPendingInviteCode(code);
        });
        removeListener = () => { void sub.remove(); };
      } catch {
        // In web without plugin, fallback URL parsing above is enough.
      }
    };

    void init();

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function syncOfflineQueue() {
      if (mounted) setIsSyncingQueue(true);
      try {
        const result = await flushOfflineQueue();
        if (mounted) setOfflinePending(result.pending);
      } finally {
        if (mounted) setIsSyncingQueue(false);
      }
    }

    syncOfflineQueue();
    const interval = setInterval(syncOfflineQueue, 15000);
    const onOnline = () => { setIsOnline(true); syncOfflineQueue(); };
    const onOffline = () => { setIsOnline(false); };
    const onStorage = () => {
      if (mounted) setOfflinePending(getOfflineQueueCount());
    };
    const onQueueUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ count?: number }>;
      const count = typeof custom.detail?.count === 'number' ? custom.detail.count : getOfflineQueueCount();
      if (mounted) setOfflinePending(count);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('storage', onStorage);
    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, onQueueUpdated as EventListener);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, onQueueUpdated as EventListener);
    };
  }, []);

  const loadBatidaData = useCallback(async (batidaId: string, userId: string) => {
    console.log('[loadBatidaData] Cargando datos de batida:', batidaId);
    // Primero obtenemos el miembro propio (siempre accesible por RLS aunque estado='abandonado')
    const miembro = await getMiBatidaMiembro(batidaId, userId);
    console.log('[loadBatidaData] Mi miembro:', miembro);

    // Si el usuario salió sin finalizar, reactivarlo ANTES de cargar el resto
    // (is_batida_member en RLS requiere estado='activo' para leer datos de otros)
    if (miembro && miembro.estado === 'abandonado') {
      try {
        await updateMiembroEstado(miembro.id, 'activo');
      } catch (e) {
        console.error('No se pudo reactivar miembro:', e);
      }
    }

    // Ahora cargamos todo con acceso completo (usuario ya activo)
    const [miembrosData, adminsData, miembroActualizado] = await Promise.all([
      getBatidaMiembros(batidaId),
      getBatidaAdmins(batidaId),
      getMiBatidaMiembro(batidaId, userId),
    ]);
    console.log('[loadBatidaData] Miembros cargados:', miembrosData.length, 'Admins:', adminsData.length);
    console.log('[loadBatidaData] Estados:', miembrosData.map(m => m.estado));
    setMiembros(miembrosData);
    const ids = new Set(adminsData.map((a: BatidaAdmin) => a.user_id));
    setAdminIds(ids);
    setAmAdmin(await isAdmin(batidaId, userId));
    setMiMiembro(miembroActualizado);
  }, []);

  useEffect(() => {
    if (!batida || !user) return;
    const ch = supabase.channel(`app-miembros-${batida.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_miembros', filter: `batida_id=eq.${batida.id}` },
        () => { loadBatidaData(batida.id, user.id); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida, user, loadBatidaData]);

  useEffect(() => {
    if (!batida || !user) return;
    const ch = supabase.channel(`app-admins-${batida.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_admins', filter: `batida_id=eq.${batida.id}` },
        () => { loadBatidaData(batida.id, user.id); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida, user, loadBatidaData]);

  // Al recibir un SOS de otro usuario, emitir alarma sonora/haptica por 3 segundos.
  useEffect(() => {
    if (!batida || !user) return;

    const ch = supabase.channel(`app-sos-audio-${batida.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'batida_chat_mensajes',
        filter: `batida_id=eq.${batida.id}`,
      }, (payload) => {
        const row = payload.new as { user_id?: string; mensaje?: string; created_at?: string };
        const incomingText = row?.mensaje || '';
        const isOtherUser = row?.user_id && row.user_id !== user.id;
        const isSos = incomingText.includes('🚨 SOS DE SEGURIDAD');

        if (isOtherUser && isSos) {
          if (row.created_at) {
            lastSosNotifiedAtRef.current = row.created_at;
          }
          void handleIncomingSosAlert('Otro miembro ha enviado un SOS.');
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [batida, user]);

  // Al volver de segundo plano, revisar SOS recibidos durante bloqueo/suspensión.
  useEffect(() => {
    if (!batida || !user) return;

    let cancelled = false;

    const checkMissedSos = async () => {
      if (cancelled || appIsActiveRef.current === false) return;
      try {
        const msgs = await getMensajes(batida.id);
        if (cancelled || msgs.length === 0) return;

        const latestSos = msgs
          .filter((m) => m.user_id !== user.id && typeof m.mensaje === 'string' && m.mensaje.includes('🚨 SOS DE SEGURIDAD'))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (!latestSos) return;
        if (!lastSosNotifiedAtRef.current) {
          lastSosNotifiedAtRef.current = latestSos.created_at;
          return;
        }

        if (new Date(latestSos.created_at).getTime() > new Date(lastSosNotifiedAtRef.current).getTime()) {
          lastSosNotifiedAtRef.current = latestSos.created_at;
          await handleIncomingSosAlert('Se detectó un SOS mientras la app estaba en segundo plano.');
        }
      } catch {
        // ignore
      }
    };

    const subPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      appIsActiveRef.current = isActive;
      if (isActive) {
        void checkMissedSos();
      }
    }).catch(() => null);

    void checkMissedSos();

    return () => {
      cancelled = true;
      void subPromise.then((sub) => {
        if (sub) void sub.remove();
      });
    };
  }, [batida, user]);

  // Polling para badge de mensajes sin leer
  useEffect(() => {
    if (!batida || !user) return;

    // Inicializar conteo base al entrar a una batida
    if (lastSeenBatidaId.current !== batida.id) {
      lastSeenBatidaId.current = batida.id;
      getMensajes(batida.id).then(msgs => {
        lastSeenMsgCount.current = msgs.length;
        setChatUnread(0);
      });
    }

    const interval = setInterval(async () => {
      if (tabRef.current === 'chat') return; // si estamos en chat no actualizamos
      try {
        const msgs = await getMensajes(batida.id);
        const base = lastSeenMsgCount.current;
        const newCount = Math.max(0, msgs.length - base);
        if (newCount > 0) setChatUnread(newCount);
      } catch { /* silently ignore */ }
    }, 5000); // cada 5 segundos

    return () => clearInterval(interval);
  }, [batida, user]);

  useEffect(() => {
    if (!batida || !user || !miMiembro) return;
    const ch = supabase.channel(`app-mi-miembro-${batida.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'batida_miembros', filter: `id=eq.${miMiembro.id}`,
      }, (payload) => {
        const updated = payload.new as BatidaMiembro;
        setMiMiembro(updated);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida, user, miMiembro]);

  async function handleEnterBatida(b: Batida) {
    if (!user) return;
    setBatidaLoading(true);
    setBatida(b);
    // Pequeña pausa para que Supabase sincronice los datos
    await new Promise(resolve => setTimeout(resolve, 500));
    await loadBatidaData(b.id, user.id);
    setBatidaLoading(false);
  }

  async function handleRefresh() {
    if (!batida || !user) return;
    // Pequeña pausa para que se sincronice
    await new Promise(resolve => setTimeout(resolve, 300));
    await loadBatidaData(batida.id, user.id);
    const fresh = await getBatida(batida.id);
    if (fresh) setBatida(fresh);
  }

  function handleLeave() {
    setBatida(null);
    setMiMiembro(null);
    setMiembros([]);
    setAdminIds(new Set());
    setAmAdmin(false);
    setTab('mapa');
    setChatUnread(0);
  }

  function goToMapa() { setTab('mapa'); }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-forest flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-amber rounded-xl flex items-center justify-center">
            <TreePine className="w-7 h-7 text-forest-dark" />
          </div>
          <Loader2 className="w-6 h-6 text-amber animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (batidaLoading) {
    return (
      <div className="min-h-screen bg-forest flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber animate-spin" />
      </div>
    );
  }

  if (!batida) {
    return (
      <BatidaScreen
        onEnterBatida={handleEnterBatida}
        inviteCode={pendingInviteCode}
        onInviteCodeConsumed={() => setPendingInviteCode(null)}
      />
    );
  }

  if (miMiembro && miMiembro.estado === 'pendiente') {
    return (
      <EsperandoScreen
        batida={batida}
        onLeave={handleLeave}
        onApproved={() => loadBatidaData(batida.id, user.id)}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-forest overflow-hidden">
      {/* Header */}
      <div className="bg-surface border-b border-forest-border px-4 py-2.5 flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 bg-amber rounded-lg flex items-center justify-center">
          <TreePine className="w-4 h-4 text-forest-dark" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-sm leading-tight truncate">{batida.nombre}</h1>
          <p className="text-forest-muted text-xs">
            {miembros.filter(m => m.estado === 'activo').length} activos
            {amAdmin ? ' · Admin' : ''}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${batida.estado === 'activa' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
          {batida.estado === 'activa' ? '● Activa' : 'Finalizada'}
        </span>
        {isSyncingQueue && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-900/40 text-blue-300 border border-blue-700/60">
            Sincronizando...
          </span>
        )}
        {!isOnline && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-900/40 text-red-300 border border-red-700/60">
            Sin conexion
          </span>
        )}
        {isOnline && !isSyncingQueue && offlinePending === 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-900/30 text-emerald-300 border border-emerald-700/50">
            Cola vacia
          </span>
        )}
        {offlinePending > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber/20 text-amber border border-amber/50">
            {offlinePending} pendientes
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className={`h-full ${tab !== 'mapa' ? 'hidden' : ''}`}>
          <MapaSection batida={batida} miembros={miembros} miMiembro={miMiembro} isAdmin={amAdmin} active={tab === 'mapa'} />
        </div>
        {tab === 'registro' && (
          <RegistroSection batida={batida} miembros={miembros} isAdmin={amAdmin} onBack={goToMapa} />
        )}
        {tab === 'totales' && (
          <TotalesSection batida={batida} miembros={miembros} onBack={goToMapa} />
        )}
        {tab === 'chat' && (
          <ChatSection
            batidaId={batida.id}
            miembros={miembros}
            miMiembro={miMiembro}
            isAdmin={amAdmin}
            active={tab === 'chat'}
            onUnreadChange={setChatUnread}
            onBack={goToMapa}
          />
        )}
        {tab === 'alerta' && (
          <AlertaPerrosSection batida={batida} onBack={goToMapa} isAdmin={amAdmin} />
        )}
        {tab === 'batida' && (
          <BatidaInfoSection
            batida={batida}
            miembros={miembros}
            adminIds={adminIds}
            miMiembro={miMiembro}
            isAdmin={amAdmin}
            onLeave={handleLeave}
            onRefresh={handleRefresh}
            onBack={goToMapa}
          />
        )}
        {tab === 'perfil' && (
          <PerfilSection onBack={goToMapa} batidaId={batida.id} />
        )}
      </div>

      {/* Tab bar */}
      <div className="bg-surface border-t border-forest-border shrink-0 safe-area-bottom overflow-x-auto">
        <div className="flex gap-1 px-1 py-2">
          {([
            { id: 'mapa' as Tab, label: 'Mapa', icon: Map },
            { id: 'registro' as Tab, label: 'Registro', icon: FileText },
            { id: 'totales' as Tab, label: 'Totales', icon: BarChart3 },
            { id: 'chat' as Tab, label: 'Chat', icon: MessageCircle, badge: chatUnread },
            { id: 'alerta' as Tab, label: 'Alerta', icon: Bell },
            { id: 'batida' as Tab, label: 'Batida', icon: Info },
            { id: 'perfil' as Tab, label: 'Perfil', icon: UserCircle2 },
          ] as { id: Tab; label: string; icon: typeof Map; badge?: number }[]).map(({ id, label, icon: Icon, badge }) => (
            <button key={id} onClick={() => { setTab(id); if (id === 'chat') { setChatUnread(0); getMensajes(batida.id).then(msgs => { lastSeenMsgCount.current = msgs.length; }); } }}
              className={`min-w-[88px] flex-1 shrink-0 flex flex-col items-center justify-center py-2 gap-0.5 rounded-2xl ${tab === id ? 'text-amber bg-forest-dark/80' : 'text-forest-muted hover:text-forest-light bg-forest-dark/20'} transition-colors`}>
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
