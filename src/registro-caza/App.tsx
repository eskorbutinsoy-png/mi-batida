import { useState, useEffect, useCallback } from 'react';
import {
  Home, Dog, Crosshair, HeartPulse, MapPin, Phone,
  BarChart2, Trophy, Timer, FileText, Settings, Info, Wallet, Radio, Footprints,
  CheckSquare, RefreshCw, ShoppingCart, LogOut, UserCircle, Shield, Boxes, ChevronLeft
} from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useAppTracking } from '../lib/useAppTracking';
import PerreraScreen from './screens/PerreraScreen';
import { perrosDB, saludDB, configuracionDB, notificacionesDB } from './lib/db';
import type { Perro, Salud } from './lib/types';

import InicioSection from './sections/InicioSection';
import PerrosSection from './sections/PerrosSection';
import CaceriasSection from './sections/CaceriasSection';
import SaludSection from './sections/SaludSection';
import GpsSection from './sections/GpsSection';
import TelefonosSection from './sections/TelefonosSection';
import StatsSection from './sections/StatsSection';
import RankingSection from './sections/RankingSection';
import CronometrosSection from './sections/CronometrosSection';
import PdfSection from './sections/PdfSection';
import PersonalizacionSection from './sections/PersonalizacionSection';
import InfoSection from './sections/InfoSection';
import GastosSection from './sections/GastosSection';
import CollaresGpsSection from './sections/CollaresGpsSection';
import RastreosSection from './sections/RastreosSection';
import TareasSection from './sections/TareasSection';
import RutinasSection from './sections/RutinasSection';
import ListaCompraSection from './sections/ListaCompraSection';
import PerfilSection from './sections/PerfilSection';
import AdminPerreraSection from './sections/AdminPerreraSection';
import InventarioSection from './sections/InventarioSection';

const SECTIONS = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'perros', label: 'Perros', icon: Dog },
  { id: 'cacerias', label: 'Cacerías', icon: Crosshair },
  { id: 'salud', label: 'Salud', icon: HeartPulse },
  { id: 'telefonos', label: 'Teléfonos', icon: Phone },
  { id: 'collares', label: 'Collares GPS', icon: Radio },
  { id: 'gps', label: 'GPS', icon: MapPin },
  { id: 'rastreos', label: 'Rastreos', icon: Footprints },
  { id: 'cronometros', label: 'Cronómetros', icon: Timer },
  { id: 'gastos', label: 'Gastos', icon: Wallet },
  { id: 'compra', label: 'Compra', icon: ShoppingCart },
  { id: 'inventario', label: 'Inventario', icon: Boxes },
  { id: 'tareas', label: 'Tareas', icon: CheckSquare },
  { id: 'rutinas', label: 'Rutinas', icon: RefreshCw },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'stats', label: 'Stats', icon: BarChart2 },
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'personalizacion', label: 'Personal.', icon: Settings },
  { id: 'perfil', label: 'Mi Perfil', icon: UserCircle },
  { id: 'admin', label: 'Admin', icon: Shield },
  { id: 'info', label: 'Info', icon: Info },
];

export interface AppConfig {
  bgImage: string;
  bgOpacity: number;
  customIcons: Record<string, string>;
}

async function solicitarPermisoPush() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function enviarNotificacionPush(alertas: Salud[], vistas: Set<string>) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  for (const a of alertas) {
    const key = `${a.id}_${a.fecha_proximo}`;
    if (vistas.has(key)) continue;
    const diff = Math.ceil((new Date(a.fecha_proximo!).getTime() - Date.now()) / 86400000);
    const perroNombre = (a as any).perro?.nombre || 'Perro';
    const texto = diff < 0
      ? `${perroNombre}: ${a.tipo} vencido hace ${Math.abs(diff)} días`
      : diff === 0
      ? `${perroNombre}: ${a.tipo} es HOY`
      : `${perroNombre}: ${a.tipo} en ${diff} días`;
    new Notification('Mi Registro de Caza - Salud', {
      body: texto,
      icon: '/icon.jpg',
      tag: key,
    });
  }
}

function MainApp({ perreraId, onBack }: { perreraId: string; onBack?: () => void }) {
  const { signOut, nombreCompleto, fotoPerfil, perrera } = useAuth();
  const { trackEvent } = useAppTracking('Mi Registro de Caza');
  const [activeSection, setActiveSection] = useState('inicio');
  const [perros, setPerros] = useState<Perro[]>([]);
  const [alertasSalud, setAlertasSalud] = useState<Salud[]>([]);
  const [notifVistas, setNotifVistas] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<AppConfig>({ bgImage: '', bgOpacity: 0.4, customIcons: {} });

  const loadPerros = useCallback(async () => {
    try {
      const data = await perrosDB.list(perreraId);
      setPerros(data);
    } catch { /* ignore */ }
  }, [perreraId]);

  const loadNotifVistas = useCallback(async () => {
    try {
      const vistas = await notificacionesDB.listVistas(perreraId);
      setNotifVistas(new Set(vistas.map(v => `${v.salud_id}_${v.fecha_proximo}`)));
    } catch { /* ignore */ }
  }, [perreraId]);

  const loadAlertas = useCallback(async () => {
    try {
      const hoy = new Date();
      const data = await saludDB.listWithPerro(perreraId);
      const proximas = data.filter(s => {
        if (!s.fecha_proximo) return false;
        const diff = Math.ceil((new Date(s.fecha_proximo).getTime() - hoy.getTime()) / 86400000);
        return diff <= (s.avisar_dias_antes ?? 7);
      });
      setAlertasSalud(proximas as Salud[]);
    } catch { /* ignore */ }
  }, [perreraId]);

  const loadConfig = useCallback(async () => {
    try {
      const all = await configuracionDB.getAll(perreraId);
      const cfg: AppConfig = { bgImage: '', bgOpacity: 0.4, customIcons: {} };
      Object.entries(all).forEach(([clave, valor]) => {
        if (clave === 'bgImage') cfg.bgImage = valor;
        else if (clave === 'bgOpacity') cfg.bgOpacity = parseFloat(valor) || 0.4;
        else if (clave.startsWith('icon_')) cfg.customIcons[clave.replace('icon_', '')] = valor;
      });
      setConfig(cfg);
    } catch { /* ignore */ }
  }, [perreraId]);

  useEffect(() => {
    loadPerros();
    loadAlertas();
    loadConfig();
    loadNotifVistas();
    solicitarPermisoPush();
  }, [loadPerros, loadAlertas, loadConfig, loadNotifVistas]);

  useEffect(() => {
    if (alertasSalud.length > 0) {
      enviarNotificacionPush(alertasSalud, notifVistas);
    }
  }, [alertasSalud, notifVistas]);

  const dismissNotif = useCallback(async (salud: Salud) => {
    await notificacionesDB.markVista(perreraId, salud.id, salud.fecha_proximo!);
    loadNotifVistas();
  }, [perreraId, loadNotifVistas]);

  const navigate = (section: string) => {
    setActiveSection(section);
    window.scrollTo(0, 0);
  };

  const renderSection = () => {
    const props = { perros, reloadPerros: loadPerros, reloadAlertas: loadAlertas, config, reloadConfig: loadConfig, perreraId };
    switch (activeSection) {
      case 'inicio': return <InicioSection {...props} alertas={alertasSalud} onNavigate={navigate} notifVistas={notifVistas} onDismiss={dismissNotif} />;
      case 'perros': return <PerrosSection {...props} />;
      case 'cacerias': return <CaceriasSection {...props} />;
      case 'salud': return <SaludSection {...props} notifVistas={notifVistas} onDismiss={dismissNotif} />;
      case 'gps': return <GpsSection perreraId={perreraId} />;
      case 'telefonos': return <TelefonosSection perreraId={perreraId} />;
      case 'stats': return <StatsSection perros={perros} perreraId={perreraId} />;
      case 'ranking': return <RankingSection perros={perros} perreraId={perreraId} />;
      case 'cronometros': return <CronometrosSection perros={perros} perreraId={perreraId} />;
      case 'pdf': return <PdfSection perros={perros} perreraId={perreraId} />;
      case 'personalizacion': return <PersonalizacionSection config={config} reloadConfig={loadConfig} perreraId={perreraId} />;
      case 'gastos': return <GastosSection perreraId={perreraId} />;
      case 'compra': return <ListaCompraSection perreraId={perreraId} />;
      case 'inventario': return <InventarioSection perreraId={perreraId} />;
      case 'tareas': return <TareasSection perreraId={perreraId} />;
      case 'rutinas': return <RutinasSection perreraId={perreraId} />;
      case 'collares': return <CollaresGpsSection perreraId={perreraId} />;
      case 'rastreos': return <RastreosSection perreraId={perreraId} />;
      case 'perfil': return <PerfilSection />;
      case 'admin': return <AdminPerreraSection />;
      case 'info': return <InfoSection onRestore={() => { loadPerros(); loadAlertas(); }} perreraId={perreraId} />;
      default: return null;
    }
  };

  const currentSection = SECTIONS.find(s => s.id === activeSection);

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        background: config.bgImage
          ? `linear-gradient(rgba(10,20,5,${config.bgOpacity}),rgba(10,20,5,${config.bgOpacity})), url(${config.bgImage}) center/cover`
          : 'linear-gradient(135deg, #0a1a05 0%, #1a3a0a 50%, #0d2408 100%)'
      }}
    >
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#0a1a05]/95 to-[#1a3a0a]/95 backdrop-blur border-b border-amber-700/30 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 transition-colors"
                title="Volver al menú de apps"
              >
                <Home size={20} />
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-amber-300 font-bold tracking-wider text-xs uppercase leading-tight">Mi Registro de Caza</span>
              {perrera && <span className="text-amber-600 text-[10px] leading-tight">{perrera.nombre}</span>}
            </div>
          </div>
          <button onClick={signOut} className="p-1 text-amber-700 hover:text-amber-400 transition-colors">
            {fotoPerfil
              ? <img src={fotoPerfil} className="w-8 h-8 rounded-full object-cover border border-amber-700/50" alt="" />
              : <div className="w-8 h-8 rounded-full bg-amber-800/50 border border-amber-700/40 flex items-center justify-center text-amber-300 text-xs font-bold">{nombreCompleto[0]?.toUpperCase() ?? <LogOut size={14}/>}</div>
            }
          </button>
        </div>
        {currentSection && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <currentSection.icon size={16} className="text-amber-500" />
            <span className="text-amber-200 text-sm font-medium">{currentSection.label}</span>
            {activeSection === 'inicio' && alertasSalud.length > 0 && (
              <span className="ml-2 bg-red-600 text-white text-xs rounded-full px-2 py-0.5 animate-pulse">
                {alertasSalud.length} aviso{alertasSalud.length > 1 ? 's' : ''}
              </span>
            )}
            {nombreCompleto && (
              <span className="ml-auto text-amber-700 text-xs truncate max-w-24">{nombreCompleto.split(' ')[0]}</span>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 pb-20">
        {renderSection()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0a1a05]/95 backdrop-blur border-t border-amber-700/30">
        <div className="flex overflow-x-auto scrollbar-hide">
          {SECTIONS.map(sec => {
            const IconComponent = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => navigate(sec.id)}
                className={`min-w-max px-4 py-2 flex flex-col items-center transition-colors ${
                  isActive ? 'text-amber-400 bg-amber-700/20' : 'text-amber-700 hover:text-amber-500'
                }`}
              >
                <IconComponent size={20} />
                <span className="text-[9px] mt-0.5">{sec.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function AppGate({ onBack }: { onBack?: () => void }) {
  const { session, loading, perrera, perreraLoading, user, memberEstado } = useAuth();

  if (loading || perreraLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a1a05 0%, #1a3a0a 50%, #0d2408 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-amber-600 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session || !user) return <PerreraScreen />;
  if (!perrera || memberEstado === null) return <PerreraScreen />;
  if (memberEstado === 'pendiente') return <PerreraScreen />;

  return <MainApp perreraId={perrera.id} onBack={onBack} />;
}

export default function App({ onBack }: { onBack?: () => void }) {
  return (
    <AuthProvider>
      <AppGate onBack={onBack} />
    </AuthProvider>
  );
}
