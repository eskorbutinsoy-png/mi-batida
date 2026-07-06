import { TreePine, BookOpen, LogOut, Loader2, Share2, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface Props {
  onSelect: (app: 'batida' | 'registro') => void;
  onShowAdmin?: () => void;
}

type UpdateManifest = {
  latestVersion: string;
  apkUrl: string;
  notes?: string;
};

type LastOtaDownload = {
  version: string;
  apkUrl: string;
  at: number;
};

const OTA_LAST_DOWNLOAD_KEY = 'mi-batida-ota-last-download';

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const aa = parse(a);
  const bb = parse(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i += 1) {
    const av = aa[i] ?? 0;
    const bv = bb[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export default function HomeSelector({ onSelect, onShowAdmin }: Props) {
  const { signOut, user } = useAuth();
  const [currentVersion, setCurrentVersion] = useState<string>('0.0.0');
  const [updateManifest, setUpdateManifest] = useState<UpdateManifest | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const defaultManifestUrl = 'https://abdwszaejrzqtjlvhakw.supabase.co/storage/v1/object/public/app-updates/latest.json';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const updateManifestUrl = (import.meta.env.VITE_UPDATE_MANIFEST_URL as string | undefined)
    || (supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/app-updates/latest.json` : undefined)
    || defaultManifestUrl;

  const isNative = Capacitor.isNativePlatform();
  const hasUpdate = isNative && !!updateManifest && compareVersions(updateManifest.latestVersion, currentVersion) > 0;

  useEffect(() => {
    let alive = true;
    const loadCurrentVersion = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const info = await CapacitorApp.getInfo();
          if (alive && info.version) setCurrentVersion(info.version);
          return;
        }
      } catch {
        // ignore
      }
      if (alive) setCurrentVersion('0.0.0');
    };
    void loadCurrentVersion();
    return () => { alive = false; };
  }, []);

  async function checkForAppUpdate() {
    setCheckingUpdate(true);
    setUpdateError('');
    try {
      const response = await fetch(`${updateManifestUrl}?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('No se pudo leer el manifiesto de actualizacion.');
      }
      const data = await response.json() as Partial<UpdateManifest>;
      if (!data.latestVersion || !data.apkUrl) {
        throw new Error('Manifiesto incompleto: requiere latestVersion y apkUrl.');
      }
      setUpdateManifest({
        latestVersion: data.latestVersion,
        apkUrl: data.apkUrl,
        notes: data.notes,
      });
    } catch {
      setUpdateManifest(null);
      setUpdateError('No se pudo comprobar si hay actualizaciones.');
    } finally {
      setCheckingUpdate(false);
    }
  }

  useEffect(() => {
    void checkForAppUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateManifestUrl, currentVersion]);

  async function handleUpdateApp() {
    if (!updateManifest?.apkUrl || updatingApp) return;
    setUpdatingApp(true);
    setUpdateError('');
    try {
      if (!updateManifest.apkUrl.includes(updateManifest.latestVersion)) {
        setUpdateError('El enlace no coincide con la version mas reciente. Pulsa "Comprobar actualizacion ahora".');
        return;
      }

      let lastDownload: LastOtaDownload | null = null;
      try {
        const raw = localStorage.getItem(OTA_LAST_DOWNLOAD_KEY);
        if (raw) {
          lastDownload = JSON.parse(raw) as LastOtaDownload;
        }
      } catch {
        lastDownload = null;
      }

      const now = Date.now();
      const sameVersionRecentlyRequested =
        !!lastDownload
        && lastDownload.version === updateManifest.latestVersion
        && now - lastDownload.at < 10 * 60 * 1000;

      if (sameVersionRecentlyRequested) {
        setUpdateError(`La descarga de la version ${updateManifest.latestVersion} ya se inicio hace poco.`);
        return;
      }

      const downloadUrl = `${updateManifest.apkUrl}${updateManifest.apkUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(updateManifest.latestVersion)}`;

      localStorage.setItem(OTA_LAST_DOWNLOAD_KEY, JSON.stringify({
        version: updateManifest.latestVersion,
        apkUrl: updateManifest.apkUrl,
        at: now,
      } satisfies LastOtaDownload));

      window.location.assign(downloadUrl);
    } catch {
      setUpdateError('No se pudo abrir la descarga del APK.');
    } finally {
      setUpdatingApp(false);
    }
  }

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div
      className="flex flex-col items-center justify-center bg-forest"
      style={{ height: '100dvh', padding: '24px' }}
    >
      {/* Logo */}
      <div className="flex justify-center mb-8 flex-shrink-0">
        <img 
          src="/icon.png" 
          alt="Mi Gestión de Caza" 
          className="w-64 h-auto drop-shadow-2xl"
        />
      </div>

      <div className="w-full max-w-sm space-y-4 flex-1 flex flex-col justify-start">
        {/* Mi Batida */}
        <button
          onClick={() => onSelect('batida')}
          className="w-full bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-amber/40 hover:border-amber rounded-3xl p-6 text-left transition-all duration-200 hover:shadow-lg hover:shadow-amber/10 active:scale-95"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber/20 border-2 border-amber/40 rounded-2xl flex items-center justify-center shrink-0">
              <TreePine className="w-7 h-7 text-amber" />
            </div>
            <div>
              <p className="text-white font-black text-lg">🌲 Mi Batida</p>
              <p className="text-forest-muted text-sm mt-0.5">Batidas colectivas, mapa, rastros y alertas</p>
            </div>
          </div>
        </button>

        {/* Mi Registro de Caza */}
        <button
          onClick={() => onSelect('registro')}
          className="w-full bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-green-700/40 hover:border-green-500 rounded-3xl p-6 text-left transition-all duration-200 hover:shadow-lg hover:shadow-green-500/10 active:scale-95"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-900/30 border-2 border-green-700/40 rounded-2xl flex items-center justify-center shrink-0">
              <BookOpen className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <p className="text-white font-black text-lg">🎯 Mi Registro de Caza</p>
              <p className="text-forest-muted text-sm mt-0.5">Perros, cacerías, salud, gastos y más</p>
            </div>
          </div>
        </button>

        {/* Actualización de app (solo Android) */}
        {isNative && (
          <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-amber/30 rounded-3xl p-6 space-y-4">
            <div>
              <p className="text-white text-base font-black">🔄 Actualizaciones</p>
              <p className="text-amber text-xs font-black mt-1">Versión instalada: {currentVersion}</p>
            </div>

            {hasUpdate && updateManifest && (
              <div className="rounded-xl border-2 border-green-700/50 bg-green-900/20 p-3.5 space-y-2">
                <p className="text-green-300 text-sm font-black">Nueva versión disponible: {updateManifest.latestVersion}</p>
                {updateManifest.notes && (
                  <p className="text-green-100/90 text-xs leading-snug">{updateManifest.notes}</p>
                )}
                <button
                  type="button"
                  onClick={handleUpdateApp}
                  disabled={updatingApp}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-black text-sm disabled:opacity-60"
                >
                  {updatingApp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  Actualizar app
                </button>
              </div>
            )}

            {!hasUpdate && !checkingUpdate && !updateError && (
              <p className="text-forest-muted text-xs">La app ya está actualizada.</p>
            )}

            {updateError && (
              <p className="text-red-300 text-xs bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2">{updateError}</p>
            )}

            <button
              type="button"
              onClick={() => void checkForAppUpdate()}
              disabled={checkingUpdate}
              className="w-full py-2.5 rounded-xl border-2 border-amber/50 text-amber hover:border-amber-light hover:text-amber-light text-xs font-black disabled:opacity-60 transition-all"
            >
              {checkingUpdate ? 'Comprobando actualización...' : 'Comprobar actualización ahora'}
            </button>
          </div>
        )}

        <div className="flex-1"></div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-red-700/60 text-red-400 hover:text-red-300 hover:border-red-600 text-base font-black transition-all hover:bg-red-900/20"
        >
          <LogOut className="w-5 h-5" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
