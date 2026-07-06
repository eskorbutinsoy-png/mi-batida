import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { upsertPerfil, saveSecurityBackup, getSecurityBackup, clearSecurityBackup, addMensaje } from '../lib/db';
import { hashSecurityAnswer } from '../lib/security';
import { supabase } from '../lib/supabase';
import { getSavedOfflineMaps, deleteSavedOfflineMapWithTiles, createSharedOfflineMapMessage } from '../lib/offlineMaps';
import type { SavedOfflineMap } from '../lib/offlineMaps';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { User, Mail, Pencil, Check, X, Loader2, LogOut, TreePine, ShieldCheck, Camera, Trash2, Share2 } from 'lucide-react';

interface Props {
  onBack?: () => void;
  batidaId?: string;
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

export default function PerfilSection({ onBack, batidaId }: Props) {
  const { user, perfil, signOut, refreshPerfil } = useAuth();
  const defaultManifestUrl = 'https://abdwszaejrzqtjlvhakw.supabase.co/storage/v1/object/public/app-updates/latest.json';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const updateManifestUrl = (import.meta.env.VITE_UPDATE_MANIFEST_URL as string | undefined)
    || (supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/app-updates/latest.json` : undefined)
    || defaultManifestUrl;

  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(perfil?.nombre_completo ?? '');
  const [foto, setFoto] = useState<string | null>(perfil?.foto ?? null);
  const [preguntaSeguridad, setPreguntaSeguridad] = useState(perfil?.pregunta_seguridad ?? '');
  const [respuestaSeguridad, setRespuestaSeguridad] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [offlineMaps, setOfflineMaps] = useState<SavedOfflineMap[]>([]);
  const [sharingMapId, setSharingMapId] = useState<string | null>(null);
  const [deletingMapId, setDeletingMapId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentVersion, setCurrentVersion] = useState<string>('0.0.0');
  const [updateManifest, setUpdateManifest] = useState<UpdateManifest | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const preguntaInputRef = useRef<HTMLInputElement | null>(null);
  const respuestaInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNombre(perfil?.nombre_completo ?? '');
    setFoto(perfil?.foto ?? null);
    setPreguntaSeguridad(perfil?.pregunta_seguridad ?? '');
    setRespuestaSeguridad('');
  }, [perfil?.nombre_completo, perfil?.foto, perfil?.pregunta_seguridad]);

  useEffect(() => {
    if (!user?.email) return;
    const backup = getSecurityBackup(user.email);
    if (!perfil?.pregunta_seguridad?.trim() && backup?.question) {
      setPreguntaSeguridad(backup.question);
    }
  }, [perfil?.pregunta_seguridad, user?.email]);

  useEffect(() => {
    if (!editing) return;
    window.setTimeout(() => preguntaInputRef.current?.focus(), 0);
  }, [editing]);

  useEffect(() => {
    setOfflineMaps(getSavedOfflineMaps());
  }, []);

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
      // Safety check: the APK link should match the latest version offered.
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
        setSuccess(`La descarga de la version ${updateManifest.latestVersion} ya se inicio hace poco.`);
        return;
      }

      const downloadUrl = `${updateManifest.apkUrl}${updateManifest.apkUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(updateManifest.latestVersion)}`;

      localStorage.setItem(OTA_LAST_DOWNLOAD_KEY, JSON.stringify({
        version: updateManifest.latestVersion,
        apkUrl: updateManifest.apkUrl,
        at: now,
      } satisfies LastOtaDownload));

      // Use a single navigation path to avoid duplicated downloads in some mobile WebViews.
      window.location.assign(downloadUrl);
    } catch {
      setUpdateError('No se pudo abrir la descarga del APK.');
    } finally {
      setUpdatingApp(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const nombreFinal = nombre.trim() || perfil?.nombre_completo?.trim() || '';
      if (!nombreFinal) {
        setError('Introduce tu nombre para guardar el perfil.');
        return;
      }

      await upsertPerfil(user.id, {
        nombre_completo: nombreFinal,
        foto,
      });
      const preguntaAnterior = perfil?.pregunta_seguridad?.trim() || '';
      const preguntaNueva = preguntaSeguridad.trim();
      const respuestaNueva = respuestaSeguridad.trim();
      const cambiosSeguridad = preguntaNueva !== preguntaAnterior || !!respuestaNueva;

      if (cambiosSeguridad) {
        if (!user.email) {
          throw new Error('No hay email para guardar la recuperación.');
        }

        const answerHash = respuestaNueva ? await hashSecurityAnswer(respuestaNueva) : getSecurityBackup(user.email)?.answerHash || '';
        if (!preguntaNueva || !answerHash) {
          throw new Error('Debes configurar pregunta y respuesta para poder guardar la recuperación.');
        }

        await upsertPerfil(user.id, {
          pregunta_seguridad: preguntaNueva,
          respuesta_seguridad_hash: answerHash,
        });

        saveSecurityBackup(user.email, {
          question: preguntaNueva,
          answerHash,
        });
      }

      if (user.email && !preguntaSeguridad.trim()) {
        clearSecurityBackup(user.email);
      }

      await refreshPerfil();
      setEditing(false);
      setSuccess('Perfil actualizado correctamente.');
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelect(file?: File) {
    if (!file || !user) return;

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError('La foto no puede superar 5MB.');
      return;
    }

    setUploadingPhoto(true);
    setError('');
    setSuccess('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `perfiles/${user.id}/avatar_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, file);
      if (uploadError) {
        setError(`No se pudo subir la foto: ${uploadError.message}`);
        setUploadingPhoto(false);
        return;
      }
      const { data: publicData } = supabase.storage.from('chat-images').getPublicUrl(path);
      if (!publicData?.publicUrl) {
        setError('No se pudo obtener la URL de la foto.');
        setUploadingPhoto(false);
        return;
      }
      setFoto(publicData.publicUrl);
      setEditing(true);
      setSuccess('Foto cargada. Pulsa Guardar para confirmar cambios.');
    } catch {
      setError('Error subiendo la foto. Inténtalo de nuevo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleRemovePhoto() {
    setFoto(null);
    setEditing(true);
    setSuccess('Foto eliminada. Pulsa Guardar para confirmar cambios.');
  }

  function handleCancel() {
    setNombre(perfil?.nombre_completo ?? '');
    setFoto(perfil?.foto ?? null);
    setPreguntaSeguridad(perfil?.pregunta_seguridad ?? '');
    setRespuestaSeguridad('');
    setEditing(false);
    setError('');
    setSuccess('');
  }

  async function handleDeleteOfflineMap(mapId: string) {
    if (deletingMapId) return;
    setDeletingMapId(mapId);
    setError('');
    setSuccess('');
    try {
      const result = await deleteSavedOfflineMapWithTiles(mapId);
      setOfflineMaps(getSavedOfflineMaps());
      if (result.removedMap) {
        setSuccess(`Mapa offline borrado. Teselas eliminadas: ${result.removedTiles}.`);
      }
    } catch {
      setError('No se pudo borrar el mapa offline completo.');
    } finally {
      setDeletingMapId(null);
    }
  }

  async function handleShareOfflineMap(mapa: SavedOfflineMap) {
    if (!user) return;
    if (!batidaId) {
      setError('Para compartir un mapa necesitas estar dentro de una batida activa.');
      return;
    }

    setSharingMapId(mapa.id);
    setError('');
    setSuccess('');

    try {
      const message = createSharedOfflineMapMessage({
        name: mapa.name,
        layerKind: mapa.layerKind,
        bounds: mapa.bounds,
        minZoom: mapa.minZoom,
        maxZoom: mapa.maxZoom,
        sharedBy: perfil?.nombre_completo || 'Cazador',
        sharedAt: new Date().toISOString(),
      });
      await addMensaje(batidaId, user.id, message);
      setSuccess(`Mapa "${mapa.name}" compartido en el chat.`);
    } catch {
      setError('No se pudo compartir el mapa en el chat. Intenta de nuevo.');
    } finally {
      setSharingMapId(null);
    }
  }

  function layerLabel(layer: SavedOfflineMap['layerKind']): string {
    if (layer === 'hybrid') return 'Satélite híbrido';
    if (layer === 'satellite') return 'Satélite';
    return 'Calles';
  }

  const initials = (nombre || perfil?.nombre_completo || 'U')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  const memberSince = perfil?.created_at
    ? new Date(perfil.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : null;

  const hasUpdate = !!updateManifest && compareVersions(updateManifest.latestVersion, currentVersion) > 0;

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        {onBack && (
          <button onClick={onBack} className="text-amber hover:text-amber-light transition-colors p-2 -ml-2 rounded-lg hover:bg-forest-hover">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <h2 className="text-white font-black text-xl">👤 Mi perfil</h2>
      </div>

      {/* Avatar + nombre */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) handlePhotoSelect(selected);
            e.currentTarget.value = '';
          }}
          className="hidden"
        />
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber to-amber-light border-2 border-amber/60 flex items-center justify-center shadow-lg overflow-hidden">
          {foto ? (
            <img src={foto} alt="Foto de perfil" className="w-full h-full object-cover" />
          ) : (
            <span className="text-forest-dark text-5xl font-black">{initials}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-forest border-2 border-amber/50 text-amber hover:border-amber disabled:opacity-60 text-xs font-black"
          >
            {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {foto ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {foto && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-900/30 border-2 border-red-700/50 text-red-300 hover:border-red-500 text-xs font-black"
            >
              <Trash2 className="w-4 h-4" />
              Quitar
            </button>
          )}
          {editing && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploadingPhoto}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-900/30 border-2 border-green-700/50 text-green-300 hover:border-green-500 hover:text-green-200 text-xs font-black disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar
            </button>
          )}
        </div>
        {!editing ? (
          <div className="text-center">
            <p className="text-white text-xl font-black">{perfil?.nombre_completo}</p>
            {memberSince && (
              <p className="text-amber text-xs mt-2 flex items-center justify-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4" /> Miembro desde {memberSince}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Datos */}
      <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-forest-border rounded-2xl overflow-hidden">
        {/* Nombre */}
        <div className="px-5 py-4 flex items-center gap-4 border-b-2 border-forest-border">
          <div className="w-10 h-10 bg-forest rounded-lg flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-amber" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber text-xs font-black mb-1.5">Nombre completo</p>
            {editing ? (
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full bg-forest-dark border-2 border-amber rounded-lg focus:border-amber-light outline-none py-2 px-3 text-white font-bold text-base"
                autoFocus
              />
            ) : (
              <p className="text-white text-base font-black truncate">{perfil?.nombre_completo}</p>
            )}
          </div>
          {!editing && (
            <button
              onClick={() => { setNombre(perfil?.nombre_completo ?? ''); setEditing(true); }}
              className="p-2 text-amber hover:text-amber-light transition-all border-2 border-transparent hover:border-amber rounded-lg bg-forest hover:bg-forest-dark shrink-0"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Email */}
        <div className="px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-forest rounded-lg flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-amber" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber text-xs font-black mb-1.5">Correo electrónico</p>
            <p className="text-white text-base font-bold truncate">{user?.email}</p>
          </div>
        </div>

        {/* Seguridad */}
        <div className="px-5 py-4 flex items-start gap-4 border-t-2 border-forest-border">
          <div className="w-10 h-10 bg-forest rounded-lg flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber" />
          </div>
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-amber text-xs font-black">Pregunta de seguridad</p>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs font-black text-amber hover:text-amber-light underline underline-offset-4"
                >
                  Configurar
                </button>
              )}
            </div>
            <p className="text-forest-muted text-[11px] leading-snug">
              Esta pregunta se usa para recuperar la contraseña desde la app.
            </p>
            {editing ? (
              <>
                <input
                  ref={preguntaInputRef}
                  value={preguntaSeguridad}
                  onChange={e => setPreguntaSeguridad(e.target.value)}
                  placeholder="Ej: Nombre de mi primer perro"
                  className="w-full bg-forest-dark border-2 border-amber rounded-lg focus:border-amber-light outline-none py-2 px-3 text-white font-bold text-sm"
                />
                <input
                  ref={respuestaInputRef}
                  value={respuestaSeguridad}
                  onChange={e => setRespuestaSeguridad(e.target.value)}
                  placeholder="Respuesta para recuperación (opcional si no cambias)"
                  className="w-full bg-forest-dark border-2 border-amber rounded-lg focus:border-amber-light outline-none py-2 px-3 text-white font-bold text-sm"
                />
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-white text-sm font-semibold truncate">
                  {perfil?.pregunta_seguridad || (user?.email ? getSecurityBackup(user.email)?.question : null) || 'No configurada'}
                </p>
                {(perfil?.pregunta_seguridad || (user?.email ? getSecurityBackup(user.email)?.question : null)) && (
                  <span className="text-[11px] text-green-300 font-black border-2 border-green-700/40 bg-green-900/20 px-2 py-1 rounded-lg shrink-0">
                    Lista para recuperar
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save/cancel */}
      {editing && (
        <div className="space-y-3">
          {error && <p className="text-red-300 text-sm bg-red-900/40 border-2 border-red-700/60 px-4 py-3 rounded-2xl font-medium">{error}</p>}
          {success && <p className="text-green-300 text-sm bg-green-900/40 border-2 border-green-700/60 px-4 py-3 rounded-2xl font-medium">{success}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-forest-border text-amber hover:text-amber-light hover:border-amber font-black text-base transition-all"
            >
              <X className="w-5 h-5" /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || uploadingPhoto}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber to-amber-light hover:from-amber-light hover:to-amber text-forest-dark font-black text-base transition-all shadow-lg disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Guardar
            </button>
          </div>
        </div>
      )}

      {!editing && success && (
        <p className="text-green-300 text-sm bg-green-900/40 border-2 border-green-700/60 px-4 py-3 rounded-2xl font-medium">{success}</p>
      )}

      {!editing && error && (
        <p className="text-red-300 text-sm bg-red-900/40 border-2 border-red-700/60 px-4 py-3 rounded-2xl font-medium">{error}</p>
      )}

      <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-forest-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-white font-black text-base">🗺️ Mis mapas offline</h3>
          <span className="text-[11px] text-amber font-black border-2 border-amber/40 bg-amber/10 rounded-lg px-2 py-1">{offlineMaps.length}</span>
        </div>
        {offlineMaps.length === 0 ? (
          <p className="text-forest-muted text-sm">Aún no tienes mapas offline guardados. Crea uno desde el mapa y ponle nombre.</p>
        ) : (
          <div className="space-y-2.5">
            {offlineMaps.map((mapa) => (
              <div key={mapa.id} className="bg-forest/70 border-2 border-forest-border rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-black truncate">{mapa.name}</p>
                    <p className="text-amber text-[11px] mt-1 font-bold">{layerLabel(mapa.layerKind)} · Zoom {mapa.minZoom}-{mapa.maxZoom}</p>
                    <p className="text-forest-muted text-[11px] mt-1">{new Date(mapa.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-forest-muted text-[11px] mt-1">Teselas: {mapa.downloadedTiles}/{mapa.totalTiles} · Fallidas: {mapa.failedTiles}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleShareOfflineMap(mapa)}
                      disabled={sharingMapId === mapa.id || deletingMapId === mapa.id || !batidaId}
                      className="px-2.5 py-1.5 rounded-lg border-2 border-cyan-700/50 text-cyan-200 hover:border-cyan-500 text-[11px] font-black disabled:opacity-50"
                    >
                      {sharingMapId === mapa.id ? (
                        <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Enviando</span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><Share2 className="w-3 h-3" /> Compartir</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOfflineMap(mapa.id)}
                      disabled={deletingMapId === mapa.id}
                      className="px-2.5 py-1.5 rounded-lg border-2 border-red-700/50 text-red-300 hover:border-red-500 text-[11px] font-black disabled:opacity-50"
                    >
                      {deletingMapId === mapa.id ? (
                        <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Borrando</span>
                      ) : (
                        'Borrar'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* App info */}
      <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-amber/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber/20 border-2 border-amber/50 rounded-xl flex items-center justify-center shrink-0">
            <TreePine className="w-6 h-6 text-amber" />
          </div>
          <div>
            <p className="text-white text-base font-black">🌲 Mi Batida</p>
            <p className="text-forest-muted text-xs font-medium mt-1">Creada por Sergio Ibero Moreno</p>
            <p className="text-amber text-xs font-black mt-1">Version instalada: {currentVersion}</p>
          </div>
        </div>

        {hasUpdate && updateManifest && (
          <div className="rounded-xl border-2 border-green-700/50 bg-green-900/20 p-3.5 space-y-2">
            <p className="text-green-300 text-sm font-black">Nueva version disponible: {updateManifest.latestVersion}</p>
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
          <p className="text-forest-muted text-xs">La app ya esta actualizada.</p>
        )}

        {updateError && (
          <p className="text-red-300 text-xs bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2">{updateError}</p>
        )}

        <button
          type="button"
          onClick={() => void checkForAppUpdate()}
          disabled={checkingUpdate}
          className="w-full py-2.5 rounded-xl border-2 border-amber/50 text-amber hover:border-amber-light hover:text-amber-light text-xs font-black disabled:opacity-60"
        >
          {checkingUpdate ? 'Comprobando actualizacion...' : 'Comprobar actualizacion ahora'}
        </button>

        <div className="text-[11px] text-forest-muted leading-snug">
          Si hay una version nueva, se abrira la descarga del APK y Android pedira confirmar la instalacion.
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-red-700/60 text-red-400 hover:text-red-300 hover:border-red-600 text-base font-black transition-all hover:bg-red-900/20"
      >
        <LogOut className="w-5 h-5" /> Cerrar sesión
      </button>
    </div>
  );
}
