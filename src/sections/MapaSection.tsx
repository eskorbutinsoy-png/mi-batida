import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker, LayerGroup } from 'leaflet';
import type { Batida, BatidaMiembro, BatidaPosicion, BatidaRastro, BatidaPuestoMapa, BatidaRegistro, BatidaAlerta, EspecieRastro, AntiguedadRastro, BatidaMensaje } from '../lib/types';
import { ALERTA_PERRO_LABELS, ESPECIE_RASTRO_LABELS, ANTIGUEDAD_LABELS, ESPECIE_LABELS } from '../lib/types';
import { upsertPosicion, getPosiciones, getRastros, addRastro, getPuestosMapa, addPuestoMapa, deletePuestoMapa, deleteRastro, getRegistros, getAlertasPerro, addMensaje, getMensajes, deleteMensaje, notifySosPush } from '../lib/db';
import { enqueueOfflineAction } from '../lib/offlineQueue';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { playSosAlarm, unlockSosAudio } from '../lib/sosAlarm';
import {
  createOfflineTileLayer,
  downloadOfflineTiles,
  estimateTilesForBounds,
  formatBytes,
  getOfflineProviderStats,
  clearOfflineProvider,
  saveOfflineMap,
} from '../lib/offlineMaps';
import { Navigation, Plus, MapPin, Crosshair, X, Loader2, AlertCircle, Siren } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';

const LAST_MAP_POSITION_KEY = 'mi-batida-last-map-position';

type MapLayerKind = 'satellite' | 'hybrid' | 'streets';

type OfflineBounds = { north: number; south: number; east: number; west: number };

const TILE_SOURCES = {
  streets: {
    providerId: 'streets-osm',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
  },
  satellite: {
    providerId: 'satellite-esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
  },
  hybrid: {
    providerId: 'satellite-esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsProviderId: 'hybrid-labels-osm',
    labelsUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
  },
} as const;

function loadLastMapPosition(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(LAST_MAP_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

function saveLastMapPosition(position: { lat: number; lng: number }) {
  try {
    localStorage.setItem(LAST_MAP_POSITION_KEY, JSON.stringify(position));
  } catch {
    /* ignore */
  }
}

function formatRelativeTime(date: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (elapsedSeconds < 60) return `hace ${elapsedSeconds}s`;
  if (elapsedSeconds < 3600) return `hace ${Math.floor(elapsedSeconds / 60)}m`;
  if (elapsedSeconds < 86400) return `hace ${Math.floor(elapsedSeconds / 3600)}h`;
  return `hace ${Math.floor(elapsedSeconds / 86400)}d`;
}

async function getNativePosition(): Promise<{ lat: number; lng: number }> {
  try {
    await Geolocation.requestPermissions();
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    // fallback to web API
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        reject,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });
  }
}

interface Props {
  batida: Batida;
  miembros: BatidaMiembro[];
  miMiembro?: BatidaMiembro | null;
  isAdmin: boolean;
  active?: boolean;
}

const GPS_INTERVALS = [
  { label: 'Manual', value: 0 },
  { label: '1 min', value: 60000 },
  { label: '5 min', value: 300000 },
  { label: '10 min', value: 600000 },
];

const ANTIGUEDAD_COLORS: Record<AntiguedadRastro, string> = {
  ahora: '#ef4444',
  muy_fresca: '#f97316',
  vieja: '#6b7280',
};

function makePersonIcon(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};border:2px solid white;border-radius:50% 50% 50% 0;width:28px;height:28px;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);font-size:9px;color:white;font-weight:700;line-height:1;text-align:center;max-width:18px;overflow:hidden;white-space:nowrap;">${label}</span>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

function makeRastroIcon(color: string, especie: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};border:2px solid rgba(255,255,255,0.9);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.5);" title="${especie}">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="white">
        <path d="M7 4c1.5 0 2.7 1.8 2.7 4S8.5 12 7 12 4.3 10.2 4.3 8 5.5 4 7 4Zm10 0c1.5 0 2.7 1.8 2.7 4S18.5 12 17 12s-2.7-1.8-2.7-4S15.5 4 17 4Zm-5 5.5c1.2 0 2.2 1.3 2.2 2.9S13.2 15.3 12 15.3s-2.2-1.3-2.2-2.9S10.8 9.5 12 9.5Z"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -18],
  });
}

function makePuestoIcon(nombre: string) {
  return L.divIcon({
    className: '',
    html: `<div title="${nombre}" style="background:#d97706;border:2px solid white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);color:white;font-size:10px;font-weight:800;">P</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

function isSosMessage(msg: BatidaMensaje): boolean {
  return typeof msg.mensaje === 'string' && msg.mensaje.includes('🚨 SOS DE SEGURIDAD');
}

function extractSosCoords(message: string): { lat: number; lng: number } | null {
  const match = message.match(/📍\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function isTransientNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return !navigator.onLine;
  const maybe = error as { message?: string; code?: string };
  const message = (maybe.message || '').toLowerCase();
  const code = (maybe.code || '').toUpperCase();

  if (!navigator.onLine) return true;
  if (code === '57014') return true;
  return (
    message.includes('failed to fetch')
    || message.includes('network request failed')
    || message.includes('network error')
    || message.includes('load failed')
    || message.includes('timeout')
    || message.includes('offline')
  );
}

function getMutationErrorMessage(action: 'rastro' | 'puesto', error: unknown): string {
  const maybe = error as { code?: string; message?: string };
  if (maybe?.code === '42501') {
    return action === 'puesto'
      ? 'No tienes permiso para crear puestos en esta batida.'
      : 'No tienes permiso para crear rastros en esta batida.';
  }
  if (typeof maybe?.message === 'string' && maybe.message.trim()) {
    const label = action === 'puesto' ? 'puesto' : 'rastro';
    return `No se pudo crear el ${label}: ${maybe.message}`;
  }
  return action === 'puesto'
    ? 'No se pudo crear el puesto. Intenta de nuevo.'
    : 'No se pudo crear el rastro. Intenta de nuevo.';
}

export default function MapaSection({ batida, miembros, miMiembro, isAdmin, active }: Props) {
  const { user, perfil } = useAuth();
  const mapRef = useRef<LeafletMap | null>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const rastrosLayerRef = useRef<LayerGroup | null>(null);
  const puestosLayerRef = useRef<LayerGroup | null>(null);
  const tracksLayerRef = useRef<LayerGroup | null>(null);
  const tracksHistoryRef = useRef<Map<string, Array<{ lat: number; lng: number; ts: number }>>>(new Map());
  const mapLayerRef = useRef<L.TileLayer | null>(null);
  const mapLabelsRef = useRef<L.TileLayer | null>(null);
  const offlineAreaLayerRef = useRef<L.LayerGroup | null>(null);
  const offlinePreviewStartMarkerRef = useRef<L.Marker | null>(null);
  const offlinePreviewEndMarkerRef = useRef<L.Marker | null>(null);
  const lastKnownCenterRef = useRef<{ lat: number; lng: number } | null>(loadLastMapPosition());

  const [posiciones, setPosiciones] = useState<BatidaPosicion[]>([]);
  const [rastros, setRastros] = useState<BatidaRastro[]>([]);
  const [puestos, setPuestos] = useState<BatidaPuestoMapa[]>([]);
  const [registros, setRegistros] = useState<BatidaRegistro[]>([]);
  const [alertas, setAlertas] = useState<BatidaAlerta[]>([]);
  const [sosMensajes, setSosMensajes] = useState<BatidaMensaje[]>([]);
  const alertasLayerRef = useRef<LayerGroup | null>(null);
  const sosLayerRef = useRef<LayerGroup | null>(null);
  const [showPerreros, setShowPerreros] = useState(true);
  const [showPosturas, setShowPosturas] = useState(true);
  const [showRastros, setShowRastros] = useState(true);
  const [showPuestos, setShowPuestos] = useState(true);
  const [showYo, setShowYo] = useState(true);
  const [showAlertas, setShowAlertas] = useState(true);
  const [showTracks, setShowTracks] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapLayerKind, setMapLayerKind] = useState<MapLayerKind>('streets');
  const [mapLayersOpen, setMapLayersOpen] = useState(false);
  const [offlinePickMode, setOfflinePickMode] = useState(false);
  const [offlineBounds, setOfflineBounds] = useState<OfflineBounds | null>(null);
  const offlineSelectionStartRef = useRef<{ lat: number; lng: number } | null>(null);
  const [offlinePendingBounds, setOfflinePendingBounds] = useState<OfflineBounds | null>(null);
  const [offlineSelectionStep, setOfflineSelectionStep] = useState<'first' | 'second' | 'confirm'>('first');
  const offlineDragStartRef = useRef<{ lat: number; lng: number } | null>(null);
  const offlineDraggingRef = useRef(false);
  const offlineCurrentPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const [offlineMinZoom, setOfflineMinZoom] = useState(13);
  const [offlineMaxZoom, setOfflineMaxZoom] = useState(16);
  const [offlineMapName, setOfflineMapName] = useState('');
  const [offlineEstimatedTiles, setOfflineEstimatedTiles] = useState(0);
  const [offlineDownloading, setOfflineDownloading] = useState(false);
  const [offlineDownloadProgress, setOfflineDownloadProgress] = useState<{ downloaded: number; total: number; failed: number }>({ downloaded: 0, total: 0, failed: 0 });
  const [offlineInfo, setOfflineInfo] = useState<string | null>(null);
  const [offlineStats, setOfflineStats] = useState<Record<MapLayerKind, { tiles: number; bytes: number }>>({
    streets: { tiles: 0, bytes: 0 },
    satellite: { tiles: 0, bytes: 0 },
    hybrid: { tiles: 0, bytes: 0 },
  });
  const alertasCountRef = useRef(0);
  const sosCountRef = useRef(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [gpsInterval, setGpsInterval] = useState(0);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [sosLoading, setSosLoading] = useState(false);
  const gpsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // FAB state
  const [fabOpen, setFabOpen] = useState(false);
  const [fabMode, setFabMode] = useState<'rastro' | 'puesto' | null>(null);
  const [pickingPos, setPickingPos] = useState(false);
  const [pickedPos, setPickedPos] = useState<{ lat: number; lng: number } | null>(null);
  const pickMarkerRef = useRef<Marker | null>(null);
  const pendingModeRef = useRef<'rastro' | 'puesto' | null>(null);

  // Add rastro form
  const [rastroEspecie, setRastroEspecie] = useState<EspecieRastro>('jabali');
  const [rastroAntiguedad, setRastroAntiguedad] = useState<AntiguedadRastro>('ahora');
  const [rastroLoading, setRastroLoading] = useState(false);

  // Add puesto form
  const [puestoNombre, setPuestoNombre] = useState('');
  const [puestoLoading, setPuestoLoading] = useState(false);

  // Current GPS
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);

  const sendMyPosition = useCallback(async (shouldCenter = true) => {
    if (!user) return;
    setGpsLoading(true);
    setGpsError(null);
    try {
      const { lat, lng } = await getNativePosition();
      setMyPos({ lat, lng });
      try {
        await upsertPosicion(batida.id, user.id, lat, lng);
        lastKnownCenterRef.current = { lat, lng };
        saveLastMapPosition({ lat, lng });
      } catch {
        enqueueOfflineAction({
          type: 'position_update',
          payload: { batidaId: batida.id, userId: user.id, lat, lng },
        });
        setGpsError('Sin conexión. Posición guardada y pendiente de envío.');
      }
      getPosiciones(batida.id).then(setPosiciones);
      if (shouldCenter && mapRef.current) {
        mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
      }
    } catch {
      setGpsError('No se pudo obtener el GPS. Asegúrate de tener el GPS activado y dar permiso a la app.');
    } finally {
      setGpsLoading(false);
    }
  }, [batida.id, user]);

  const refreshMapAnnotations = useCallback(() => {
    getRastros(batida.id).then(setRastros);
    getPuestosMapa(batida.id).then(setPuestos);
  }, [batida.id]);

  const refreshMapAnnotationsWithRetry = useCallback(() => {
    refreshMapAnnotations();
    window.setTimeout(() => {
      refreshMapAnnotations();
    }, 1200);
  }, [refreshMapAnnotations]);

  const applyMapLayer = useCallback((kind: MapLayerKind) => {
    const map = mapRef.current;
    if (!map) return;

    if (mapLayerRef.current) {
      map.removeLayer(mapLayerRef.current);
      mapLayerRef.current = null;
    }
    if (mapLabelsRef.current) {
      map.removeLayer(mapLabelsRef.current);
      mapLabelsRef.current = null;
    }

    if (kind === 'streets') {
      mapLayerRef.current = createOfflineTileLayer(TILE_SOURCES.streets.url, {
        providerId: TILE_SOURCES.streets.providerId,
        maxZoom: TILE_SOURCES.streets.maxZoom,
        networkFallback: true,
      }).addTo(map);
    } else if (kind === 'satellite') {
      mapLayerRef.current = createOfflineTileLayer(TILE_SOURCES.satellite.url, {
        providerId: TILE_SOURCES.satellite.providerId,
        maxZoom: TILE_SOURCES.satellite.maxZoom,
        networkFallback: true,
      }).addTo(map);
    } else {
      mapLayerRef.current = createOfflineTileLayer(TILE_SOURCES.hybrid.url, {
        providerId: TILE_SOURCES.hybrid.providerId,
        maxZoom: TILE_SOURCES.hybrid.maxZoom,
        networkFallback: true,
      }).addTo(map);
      mapLabelsRef.current = createOfflineTileLayer(TILE_SOURCES.hybrid.labelsUrl, {
        providerId: TILE_SOURCES.hybrid.labelsProviderId,
        maxZoom: TILE_SOURCES.hybrid.maxZoom,
        networkFallback: true,
        offlineOpacity: 0.35,
        opacity: 0.35,
      }).addTo(map);
    }

    setMapLayerKind(kind);
    setMapLayersOpen(false);
  }, []);

  const refreshOfflineStats = useCallback(async () => {
    const [streetsStats, satelliteStats, hybridLabelsStats] = await Promise.all([
      getOfflineProviderStats(TILE_SOURCES.streets.providerId),
      getOfflineProviderStats(TILE_SOURCES.satellite.providerId),
      getOfflineProviderStats(TILE_SOURCES.hybrid.labelsProviderId),
    ]);

    setOfflineStats({
      streets: streetsStats,
      satellite: satelliteStats,
      hybrid: {
        tiles: satelliteStats.tiles + hybridLabelsStats.tiles,
        bytes: satelliteStats.bytes + hybridLabelsStats.bytes,
      },
    });
  }, []);

  const clearOfflineSelection = useCallback(() => {
    offlineDragStartRef.current = null;
    offlineDraggingRef.current = false;
    offlineCurrentPointRef.current = null;
    offlineSelectionStartRef.current = null;
    setOfflinePendingBounds(null);
    setOfflineSelectionStep('first');
    setOfflineBounds(null);
    setOfflineEstimatedTiles(0);
    setOfflinePickMode(false);
    if (offlineAreaLayerRef.current) {
      offlineAreaLayerRef.current.clearLayers();
    }
  }, []);

  const getOfflineTargetsForCurrentLayer = useCallback(() => {
    if (mapLayerKind === 'streets') {
      return [{ providerId: TILE_SOURCES.streets.providerId, url: TILE_SOURCES.streets.url }];
    }
    if (mapLayerKind === 'satellite') {
      return [{ providerId: TILE_SOURCES.satellite.providerId, url: TILE_SOURCES.satellite.url }];
    }
    return [
      { providerId: TILE_SOURCES.hybrid.providerId, url: TILE_SOURCES.hybrid.url },
      { providerId: TILE_SOURCES.hybrid.labelsProviderId, url: TILE_SOURCES.hybrid.labelsUrl },
    ];
  }, [mapLayerKind]);

  const handleDownloadOfflineArea = useCallback(async () => {
    if (!offlineBounds || offlineDownloading) return;

    const mapName = offlineMapName.trim();
    if (!mapName) {
      setOfflineInfo('Pon un nombre al mapa offline antes de descargar.');
      return;
    }

    const totalEstimate = estimateTilesForBounds(offlineBounds, offlineMinZoom, offlineMaxZoom);
    if (totalEstimate <= 0) {
      setOfflineInfo('Selecciona una zona valida para descargar mapas offline.');
      return;
    }

    setOfflineDownloading(true);
    setOfflineInfo(null);
    setOfflineDownloadProgress({ downloaded: 0, total: totalEstimate, failed: 0 });

    try {
      const targets = getOfflineTargetsForCurrentLayer();
      let downloadedAll = 0;
      let failedAll = 0;
      let totalAll = 0;

      for (const target of targets) {
        const result = await downloadOfflineTiles({
          provider: target.providerId,
          urlTemplate: target.url,
          bounds: offlineBounds,
          minZoom: offlineMinZoom,
          maxZoom: offlineMaxZoom,
          onProgress: (progress) => {
            const progressTotal = totalAll + progress.total;
            const progressDownloaded = downloadedAll + progress.downloaded;
            const progressFailed = failedAll + progress.failed;
            setOfflineDownloadProgress({ downloaded: progressDownloaded, total: progressTotal, failed: progressFailed });
          },
        });

        downloadedAll += result.downloaded;
        failedAll += result.failed;
        totalAll += result.total;
        setOfflineDownloadProgress({ downloaded: downloadedAll, total: totalAll, failed: failedAll });
      }

      await refreshOfflineStats();
      saveOfflineMap({
        name: mapName,
        layerKind: mapLayerKind,
        bounds: offlineBounds,
        minZoom: offlineMinZoom,
        maxZoom: offlineMaxZoom,
        downloadedTiles: downloadedAll,
        failedTiles: failedAll,
        totalTiles: totalAll,
      });
      setOfflineInfo(`Descarga completada: ${downloadedAll}/${totalAll} teselas (${failedAll} fallidas).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al descargar mapas offline.';
      setOfflineInfo(message);
    } finally {
      setOfflineDownloading(false);
    }
  }, [offlineBounds, offlineDownloading, offlineMapName, offlineMinZoom, offlineMaxZoom, getOfflineTargetsForCurrentLayer, refreshOfflineStats, mapLayerKind]);

  const handleClearOfflineForCurrentLayer = useCallback(async () => {
    if (offlineDownloading) return;
    setOfflineInfo(null);

    try {
      if (mapLayerKind === 'streets') {
        await clearOfflineProvider(TILE_SOURCES.streets.providerId);
      } else if (mapLayerKind === 'satellite') {
        await clearOfflineProvider(TILE_SOURCES.satellite.providerId);
      } else {
        await Promise.all([
          clearOfflineProvider(TILE_SOURCES.hybrid.providerId),
          clearOfflineProvider(TILE_SOURCES.hybrid.labelsProviderId),
        ]);
      }
      await refreshOfflineStats();
      setOfflineInfo('Mapa offline borrado para la capa actual.');
    } catch {
      setOfflineInfo('No se pudo borrar la cache offline de la capa actual.');
    }
  }, [mapLayerKind, offlineDownloading, refreshOfflineStats]);

  useEffect(() => {
    refreshOfflineStats();
  }, [refreshOfflineStats]);

  useEffect(() => {
    if (!offlineBounds) {
      setOfflineEstimatedTiles(0);
      return;
    }
    const estimate = estimateTilesForBounds(offlineBounds, offlineMinZoom, offlineMaxZoom);
    setOfflineEstimatedTiles(estimate);
  }, [offlineBounds, offlineMinZoom, offlineMaxZoom]);

  // Init map & Arreglo del mapa verde (Invalidate Size) + Carga automática de posición al iniciar (Punto 5 y 7)
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    
    const initialCenter = lastKnownCenterRef.current ?? { lat: 40.4, lng: -3.7 };
    const map: LeafletMap = L.map(mapDivRef.current, { zoomControl: false, attributionControl: false }).setView([initialCenter.lat, initialCenter.lng], 12);
    mapRef.current = map;
    applyMapLayer('streets');
    rastrosLayerRef.current = L.layerGroup().addTo(map);
    puestosLayerRef.current = L.layerGroup().addTo(map);
    alertasLayerRef.current = L.layerGroup().addTo(map);
    sosLayerRef.current = L.layerGroup().addTo(map);
    tracksLayerRef.current = L.layerGroup().addTo(map);
    setMapReady(true);

    // Forzar redibujado instantáneo para evitar contenedor colapsado (pantalla verde)
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    map.on('moveend', () => {
      const center = map.getCenter();
      lastKnownCenterRef.current = { lat: center.lat, lng: center.lng };
      saveLastMapPosition(lastKnownCenterRef.current);
    });

    // Ejecutar geolocalización automática al entrar por primera vez sin forzar salto a Madrid
    sendMyPosition(false);

    return () => { 
      map.remove(); 
      mapRef.current = null; 
      markersRef.current.clear();
      tracksHistoryRef.current.clear();
      if (pickMarkerRef.current) {
        pickMarkerRef.current.remove();
        pickMarkerRef.current = null;
      }
      if (offlineAreaLayerRef.current) {
        offlineAreaLayerRef.current.remove();
        offlineAreaLayerRef.current = null;
      }
      if (offlinePreviewStartMarkerRef.current) {
        offlinePreviewStartMarkerRef.current.remove();
        offlinePreviewStartMarkerRef.current = null;
      }
      if (offlinePreviewEndMarkerRef.current) {
        offlinePreviewEndMarkerRef.current.remove();
        offlinePreviewEndMarkerRef.current = null;
      }
      sosLayerRef.current = null;
      tracksLayerRef.current = null;
      mapLayerRef.current = null;
      mapLabelsRef.current = null;
    };
  }, [applyMapLayer, sendMyPosition]);

  // Forzar reajuste de tamaño continuo cada vez que la sección se monta/actualiza (Seguro extra anti-chat)
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  });

  // Si la sección pasa a estar activa (se muestra), asegurar posición y redibujado
  useEffect(() => {
    if (active && mapRef.current) {
      mapRef.current.invalidateSize();
      // enviar posición al volver a la sección
      sendMyPosition(false);
      // Asegurar recarga de rastros/puestos al volver (fallback si Realtime falla)
      refreshMapAnnotations();
      // Asegurar recarga de alertas al volver a la sección (útil si realtime falla en móvil)
      getAlertasPerro(batida.id).then(setAlertas);
      getMensajes(batida.id).then((data) => setSosMensajes(data.filter(isSosMessage)));
    }
  }, [active, batida.id, refreshMapAnnotations, sendMyPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!offlinePickMode) return;

    map.getContainer().style.cursor = 'crosshair';
    map.dragging.disable();
    map.doubleClickZoom.disable();

    function makeBounds(a: { lat: number; lng: number }, b: { lat: number; lng: number }): OfflineBounds {
      return {
        north: Math.max(a.lat, b.lat),
        south: Math.min(a.lat, b.lat),
        east: Math.max(a.lng, b.lng),
        west: Math.min(a.lng, b.lng),
      };
    }

    function ensurePreviewLayer() {
      if (!offlineAreaLayerRef.current) {
        offlineAreaLayerRef.current = L.layerGroup().addTo(map as LeafletMap);
      }
      return offlineAreaLayerRef.current;
    }

    function renderPreview(start: { lat: number; lng: number }, end?: { lat: number; lng: number }) {
      const previewLayer = ensurePreviewLayer();
      previewLayer.clearLayers();

      const makePointMarker = (point: { lat: number; lng: number }, color: string, label: string) => L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:${color};border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 8px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:800;">${label}</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      });

      if (offlinePreviewStartMarkerRef.current) {
        offlinePreviewStartMarkerRef.current.remove();
        offlinePreviewStartMarkerRef.current = null;
      }
      if (offlinePreviewEndMarkerRef.current) {
        offlinePreviewEndMarkerRef.current.remove();
        offlinePreviewEndMarkerRef.current = null;
      }

      offlinePreviewStartMarkerRef.current = makePointMarker(start, '#f59e0b', '1').addTo(previewLayer) as L.Marker;

      if (!end) return;

      offlinePreviewEndMarkerRef.current = makePointMarker(end, '#06b6d4', '2').addTo(previewLayer) as L.Marker;

      const bounds: OfflineBounds = makeBounds(start, end);
      const leafletBounds: L.LatLngBoundsExpression = [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ];

      L.rectangle(leafletBounds, {
          color: '#f59e0b',
          weight: 2,
          fillColor: '#f59e0b',
          fillOpacity: 0.12,
          dashArray: '6 4',
        }).addTo(previewLayer);
    }

    const onSelectPoint: L.LeafletEventHandlerFn = (event) => {
      const latlng = (event as L.LeafletMouseEvent).latlng;
      if (!latlng) return;
      const current = { lat: latlng.lat, lng: latlng.lng };
      const start = offlineSelectionStartRef.current;

      if (!start) {
        offlineDragStartRef.current = current;
        offlineCurrentPointRef.current = null;
        offlineDraggingRef.current = false;
        offlineSelectionStartRef.current = current;
        setOfflinePendingBounds(null);
        setOfflineSelectionStep('second');
        setOfflineInfo('Añade el segundo punto...');
        renderPreview(current);
        return;
      }

      if (offlinePendingBounds) {
        return;
      }

      const bounds = makeBounds(start, current);
      offlineCurrentPointRef.current = current;
      offlineDraggingRef.current = false;
      setOfflinePendingBounds(bounds);
      setOfflineSelectionStep('confirm');
      setOfflineInfo('Zona lista. Pulsa "Confirmar mapa" para guardarla.');
      renderPreview(start, current);
    };

    map.on('click', onSelectPoint as L.LeafletMouseEventHandlerFn);
    map.on('touchend', onSelectPoint);

    return () => {
      map.off('click', onSelectPoint as L.LeafletMouseEventHandlerFn);
      map.off('touchend', onSelectPoint);
      map.dragging.enable();
      map.doubleClickZoom.enable();
      offlineDraggingRef.current = false;
      offlineDragStartRef.current = null;
      offlineCurrentPointRef.current = null;
      if (!pickingPos) {
        map.getContainer().style.cursor = '';
      }
    };
  }, [offlinePickMode, offlinePendingBounds, pickingPos]);

  // Map tap handler for picking position
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    if (offlinePickMode) {
      return;
    }

    if (!pickingPos) {
      m.getContainer().style.cursor = '';
      return;
    }

    m.getContainer().style.cursor = 'crosshair';

    function onMapClick(e: L.LeafletMouseEvent) {
      const { lat, lng } = e.latlng;
      setPickedPos({ lat, lng });

      if (pickMarkerRef.current) {
        pickMarkerRef.current.setLatLng([lat, lng]);
      } else {
        pickMarkerRef.current = L.marker([lat, lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:#22c55e;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        }).addTo(m!);
      }
      setPickingPos(false);
      m!.getContainer().style.cursor = '';
      if (pendingModeRef.current) {
        setFabMode(pendingModeRef.current);
        pendingModeRef.current = null;
      }
    }

    m!.once('click', onMapClick);
    return () => { m!.off('click', onMapClick); };
  }, [pickingPos]);

  function closeFabMode() {
    setFabMode(null);
    setPickingPos(false);
    pendingModeRef.current = null;
    if (pickMarkerRef.current) {
      pickMarkerRef.current.remove();
      pickMarkerRef.current = null;
    }
    setPickedPos(null);
  }

  // Load initial data
  useEffect(() => {
    getPosiciones(batida.id).then(setPosiciones);
    refreshMapAnnotations();
    getRegistros(batida.id).then(setRegistros);
    getAlertasPerro(batida.id).then(setAlertas);
    getMensajes(batida.id).then((data) => setSosMensajes(data.filter(isSosMessage)));
  }, [batida.id, refreshMapAnnotations]);

  // Ensure alert layer is ready before drawing markers
  useEffect(() => {
    if (!mapReady || !alertasLayerRef.current) return;
    alertasLayerRef.current.clearLayers();
    if (!showAlertas) return;

    let lastMarker: any = null;
    alertas.forEach((a) => {
      if (a.lat == null || a.lng == null) return;
      const marker = L.marker([a.lat, a.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#ef4444;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 2px 6px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;">🐕</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -18],
        }),
      });
      const tipoLabel = ALERTA_PERRO_LABELS[a.tipo_alerta];
      const direccion = a.direccion ? `<div><b>Hacia dónde se dirige:</b> ${a.direccion}</div>` : '';
      const propietario = a.propietario ? `<div><b>Propietario:</b> ${a.propietario}</div>` : '';
      const color = a.color ? `<div><b>Color:</b> ${a.color}</div>` : '';
      const message = a.mensaje ? `<div style="margin-top:6px;color:#f9fafb">${a.mensaje}</div>` : '';
      const image = a.imagen_url ? `<img src="${a.imagen_url}" alt="alerta perro" style="width:100%;border-radius:12px;margin-top:8px;object-fit:cover;max-height:120px;" />` : '';
      const author = a.perfil?.nombre_completo ? `<div><b>Desde:</b> ${a.perfil.nombre_completo}</div>` : '';
      marker.bindPopup(`
        <div style="min-width:180px;font-family:sans-serif">
          <b style="font-size:13px">${tipoLabel}</b>
          ${author}
          ${color}
          ${propietario}
          ${direccion}
          ${message}
          ${image}
        </div>
      `);
      alertasLayerRef.current!.addLayer(marker);
      lastMarker = marker;
    });

    if (lastMarker && alertas.length > alertasCountRef.current && mapRef.current) {
      mapRef.current.setView(lastMarker.getLatLng(), Math.max(mapRef.current.getZoom(), 15));
    }
    alertasCountRef.current = alertas.length;
  }, [alertas, showAlertas, mapReady]);

  // Real-time posiciones
  useEffect(() => {
    const ch = supabase.channel(`mapa-pos-${batida.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_posiciones', filter: `batida_id=eq.${batida.id}` },
        () => { getPosiciones(batida.id).then(setPosiciones); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida.id]);

  // Real-time rastros
  useEffect(() => {
    const ch = supabase.channel(`mapa-rastros-${batida.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_rastros', filter: `batida_id=eq.${batida.id}` },
        () => { refreshMapAnnotationsWithRetry(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida.id, refreshMapAnnotationsWithRetry]);

  // Real-time puestos
  useEffect(() => {
    const ch = supabase.channel(`mapa-puestos-${batida.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_puestos_mapa', filter: `batida_id=eq.${batida.id}` },
        () => { refreshMapAnnotationsWithRetry(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida.id, refreshMapAnnotationsWithRetry]);

  // Fallback de sincronización para móvil/red inestable
  useEffect(() => {
    if (!active) return;
    refreshMapAnnotationsWithRetry();
    const timer = setInterval(() => {
      refreshMapAnnotations();
    }, 12000);
    return () => {
      clearInterval(timer);
    };
  }, [active, refreshMapAnnotations, refreshMapAnnotationsWithRetry]);

  // Real-time alertas de perros
  useEffect(() => {
    const ch = supabase.channel(`mapa-alertas-${batida.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_alertas', filter: `batida_id=eq.${batida.id}` },
        () => { getAlertasPerro(batida.id).then(setAlertas); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida.id]);

  useEffect(() => {
    const ch = supabase.channel(`mapa-sos-chat-${batida.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_chat_mensajes', filter: `batida_id=eq.${batida.id}` },
        () => { getMensajes(batida.id).then((data) => setSosMensajes(data.filter(isSosMessage))); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida.id]);

  // Real-time registros
  useEffect(() => {
    const ch = supabase.channel(`mapa-registros-${batida.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'batida_registros', filter: `batida_id=eq.${batida.id}` },
        () => { getRegistros(batida.id).then(setRegistros); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida.id]);

  // Update member markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    const now = Date.now();
    const maxAgeMs = 60 * 60 * 1000;
    const minDelta = 0.00005;

    posiciones.forEach((pos) => {
      const existingTrail = tracksHistoryRef.current.get(pos.user_id) || [];
      const last = existingTrail[existingTrail.length - 1];
      const moved = !last || Math.abs(last.lat - pos.lat) > minDelta || Math.abs(last.lng - pos.lng) > minDelta;
      const updatedTrail = moved
        ? [...existingTrail, { lat: pos.lat, lng: pos.lng, ts: now }]
        : existingTrail.map((item, idx) => (idx === existingTrail.length - 1 ? { ...item, ts: now } : item));
      tracksHistoryRef.current.set(
        pos.user_id,
        updatedTrail.filter((point) => now - point.ts <= maxAgeMs),
      );
    });

    const memberMap = new Map(miembros.map(m => [m.user_id, m]));

    // Primero: limpiar marcadores que no deberían existir
    const posUserIds = new Set(posiciones.map(p => p.user_id));
    markersRef.current.forEach((marker, uid) => {
      if (!posUserIds.has(uid)) { marker.remove(); markersRef.current.delete(uid); }
    });

    // Segundo: actualizar o crear marcadores visibles
    posiciones.forEach((pos) => {
      const miembro = memberMap.get(pos.user_id);
      const isMe = pos.user_id === user?.id;
      
      // Si es yo mismo, usar miMiembro para asegurar que el tipo es correcto
      const miembroActual = isMe && miMiembro ? miMiembro : miembro;
      if (!isMe && !miembroActual) {
        const oldMarker = markersRef.current.get(pos.user_id);
        if (oldMarker) {
          oldMarker.remove();
          markersRef.current.delete(pos.user_id);
        }
        return;
      }
      const miembroTipo = miembroActual?.tipo || 'postura';
      const isPerrero = miembroTipo === 'perrero';
      const isPostura = miembroTipo === 'postura';
      const shouldShow = (isMe && showYo) || (isPerrero && showPerreros) || (isPostura && showPosturas);

      const existing = markersRef.current.get(pos.user_id);
      
      if (!shouldShow) {
        // Si no debe mostrarse, eliminar si existe
        if (existing) {
          existing.remove();
          markersRef.current.delete(pos.user_id);
        }
        return;
      }

      // Si debe mostrarse, crear o actualizar
      const label = isMe
        ? perfil?.nombre_completo?.split(' ')[0] || miembroActual?.perfil?.nombre_completo?.split(' ')[0] || 'Yo'
        : miembroActual?.perfil?.nombre_completo?.split(' ')[0] || '?';
      const color = isMe ? '#22c55e' : (isPerrero ? '#f97316' : '#3b82f6');
      const icon = makePersonIcon(color, label);

      const nombreCompleto = isMe
        ? perfil?.nombre_completo || miembroActual?.perfil?.nombre_completo || 'Yo'
        : miembroActual?.perfil?.nombre_completo || 'Miembro';
      const puesto = miembroActual?.tipo === 'perrero' ? 'Perrero' : (`Postura${miembroActual?.puesto_nombre ? ' · ' + miembroActual.puesto_nombre : ''}`);
      const lastUpdate = `<div style="color:#9ca3af;font-size:11px;margin-top:2px">Última actualización: ${formatRelativeTime(pos.updated_at)}</div>`;
      const userRegistros = registros.filter(r => r.user_id === pos.user_id);
      const cnt: Record<string, number> = { cazado: 0, herido: 0, escapado: 0 };
      for (const r of userRegistros) cnt[r.tipo_registro] = (cnt[r.tipo_registro] || 0) + 1;
      const byEsp: Record<string, { cazado: number; herido: number; escapado: number }> = {};
      for (const r of userRegistros) {
        if (!byEsp[r.especie]) byEsp[r.especie] = { cazado: 0, herido: 0, escapado: 0 };
        byEsp[r.especie][r.tipo_registro as keyof typeof byEsp[string]]++;
      }
      const especiesHtml = Object.entries(byEsp).map(([esp, c]) => {
        const parts = [];
        if (c.cazado) parts.push(`<span style="color:#4ade80">${c.cazado}caz</span>`);
        if (c.herido) parts.push(`<span style="color:#fb923c">${c.herido}her</span>`);
        if (c.escapado) parts.push(`<span style="color:#9ca3af">${c.escapado}esc</span>`);
        const espLabel = ESPECIE_LABELS[esp as keyof typeof ESPECIE_LABELS] || esp;
        return `<div style="display:flex;gap:6px;align-items:center"><span>${espLabel}</span>${parts.join(' ')}</div>`;
      }).join('');
      const registrosHtml = userRegistros.length > 0
        ? `<div style="margin-top:6px;font-size:11px;border-top:1px solid #374151;padding-top:6px">${especiesHtml}</div>`
        : '';

      const popupContent = `<div style="font-family:sans-serif;min-width:130px">
        <b style="font-size:13px">${nombreCompleto}</b>
        <div style="color:#9ca3af;font-size:11px;margin-top:2px">${puesto}</div>
        ${lastUpdate}
        ${cnt.cazado || cnt.herido || cnt.escapado ? `<div style="display:flex;gap:8px;margin-top:4px;font-size:11px;font-weight:600">
          ${cnt.cazado ? `<span style="color:#4ade80">${cnt.cazado} caz.</span>` : ''}
          ${cnt.herido ? `<span style="color:#fb923c">${cnt.herido} her.</span>` : ''}
          ${cnt.escapado ? `<span style="color:#9ca3af">${cnt.escapado} esc.</span>` : ''}
        </div>` : ''}
        ${registrosHtml}
      </div>`;

      if (existing) {
        if (!map.hasLayer(existing)) {
          existing.addTo(map);
        }
        existing.setLatLng([pos.lat, pos.lng]).setIcon(icon);
        existing.setPopupContent(popupContent);
      } else {
        const marker = L.marker([pos.lat, pos.lng], { icon })
          .addTo(map)
          .bindPopup(popupContent);
        markersRef.current.set(pos.user_id, marker);
      }
    });
  }, [posiciones, miembros, user, perfil, registros, showPerreros, showPosturas, showYo, mapReady, miMiembro]);

  useEffect(() => {
    if (!mapReady || !tracksLayerRef.current) return;
    tracksLayerRef.current.clearLayers();
    if (!showTracks) return;

    const memberMap = new Map(miembros.map((m) => [m.user_id, m]));

    tracksHistoryRef.current.forEach((trail, userId) => {
      if (trail.length < 2) return;

      const miembro = memberMap.get(userId);
      const isMe = userId === user?.id;
      const miembroActual = isMe && miMiembro ? miMiembro : miembro;
      const tipo = miembroActual?.tipo || 'postura';
      const shouldShow = (isMe && showYo) || (tipo === 'perrero' && showPerreros) || (tipo === 'postura' && showPosturas);
      if (!shouldShow) return;

      const color = isMe ? '#22c55e' : (tipo === 'perrero' ? '#f97316' : '#3b82f6');
      const latLngs = trail.map((point) => [point.lat, point.lng]) as [number, number][];
      L.polyline(latLngs, {
        color,
        weight: 3,
        opacity: 0.75,
        lineJoin: 'round',
      }).addTo(tracksLayerRef.current!);
    });
  }, [showTracks, mapReady, miembros, user, miMiembro, showYo, showPerreros, showPosturas, posiciones]);

  // Update rastros layer
  useEffect(() => {
    if (!rastrosLayerRef.current) return;
    rastrosLayerRef.current.clearLayers();
    if (!showRastros) return;
    rastros.forEach((r) => {
      const color = ANTIGUEDAD_COLORS[r.antiguedad];
      const icon = makeRastroIcon(color, ESPECIE_RASTRO_LABELS[r.especie]);
      const marker = L.marker([r.lat, r.lng], { icon }) as any;
      marker.__markerType = 'rastro';
      const canDelete = r.user_id === user?.id || isAdmin;
      marker.bindPopup(`
        <div style="min-width:120px">
          <b>${ESPECIE_RASTRO_LABELS[r.especie]}</b><br>
          Antigüedad: ${ANTIGUEDAD_LABELS[r.antiguedad]}
          ${canDelete ? `<br><button onclick="window.__deleteRastro('${r.id}')" style="margin-top:6px;background:#ef4444;color:white;border:none;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:12px">Eliminar</button>` : ''}
        </div>
      `);
      rastrosLayerRef.current!.addLayer(marker);
    });
    (window as unknown as Record<string, unknown>).__deleteRastro = async (id: string) => {
      await deleteRastro(id);
      getRastros(batida.id).then(setRastros);
    };
  }, [rastros, user, isAdmin, batida.id, showRastros, mapReady]);

  useEffect(() => {
    if (!mapReady || !sosLayerRef.current) return;
    sosLayerRef.current.clearLayers();
    if (!showAlertas) return;

    let lastMarker: any = null;
    sosMensajes.forEach((msg) => {
      if (!msg.mensaje) return;
      const coords = extractSosCoords(msg.mensaje);
      if (!coords) return;
      const marker = L.marker([coords.lat, coords.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#dc2626;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 2px 6px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;">🚨</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -18],
        }),
      });
      const mapsLink = `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
      const author = msg.perfil?.nombre_completo ? `<div><b>Desde:</b> ${msg.perfil.nombre_completo}</div>` : '';
      const safeText = msg.mensaje.replace(/\n/g, '<br/>');
      marker.bindPopup(`
        <div style="min-width:200px;font-family:sans-serif">
          <b style="font-size:13px;color:#fee2e2">SOS de seguridad</b>
          ${author}
          <div style="margin-top:6px;color:#f9fafb;font-size:12px">${safeText}</div>
          <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;color:#fca5a5;font-weight:700;text-decoration:underline;">Abrir ubicacion</a>
        </div>
      `);
      sosLayerRef.current!.addLayer(marker);
      lastMarker = marker;
    });

    if (lastMarker && sosMensajes.length > sosCountRef.current && mapRef.current) {
      mapRef.current.setView(lastMarker.getLatLng(), Math.max(mapRef.current.getZoom(), 15));
    }
    sosCountRef.current = sosMensajes.length;
  }, [sosMensajes, showAlertas, mapReady]);

  // Update puestos layer
  useEffect(() => {
    if (!puestosLayerRef.current) return;
    puestosLayerRef.current.clearLayers();
    if (!showPuestos) return;
    puestos.forEach((p) => {
      const icon = makePuestoIcon(p.nombre);
      const marker = L.marker([p.lat, p.lng], { icon }) as any;
      marker.__markerType = 'puesto';
      if (isAdmin) {
        marker.bindPopup(`
          <div><b>${p.nombre}</b><br>
          <button onclick="window.__deletePuesto('${p.id}')" style="margin-top:6px;background:#ef4444;color:white;border:none;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:12px">Eliminar</button></div>
        `);
      } else {
        marker.bindPopup(`<b>${p.nombre}</b>`);
      }
      puestosLayerRef.current!.addLayer(marker);
    });
    (window as unknown as Record<string, unknown>).__deletePuesto = async (id: string) => {
      await deletePuestoMapa(id);
      getPuestosMapa(batida.id).then(setPuestos);
    };
  }, [puestos, isAdmin, batida.id, showPuestos, mapReady]);

  // Safeguard: remove stray markers directly added to the map when filters toggle off
  useEffect(() => {
    if (!mapRef.current) return;
    const m = mapRef.current;
    if (!showRastros) {
      m.eachLayer((layer: any) => {
        if (layer && layer.__markerType === 'rastro') {
          try { m.removeLayer(layer); } catch { /* ignore */ }
        }
      });
      rastrosLayerRef.current?.clearLayers();
    }
    if (!showPuestos) {
      m.eachLayer((layer: any) => {
        if (layer && layer.__markerType === 'puesto') {
          try { m.removeLayer(layer); } catch { /* ignore */ }
        }
      });
      puestosLayerRef.current?.clearLayers();
    }
  }, [showRastros, showPuestos]);
  useEffect(() => {
    if (gpsTimerRef.current) { clearInterval(gpsTimerRef.current); gpsTimerRef.current = null; }
    if (gpsActive && gpsInterval > 0) {
      gpsTimerRef.current = setInterval(() => sendMyPosition(false), gpsInterval);
    }
    return () => { if (gpsTimerRef.current) clearInterval(gpsTimerRef.current); };
  }, [gpsActive, gpsInterval, sendMyPosition]);

  const effectivePos = pickedPos ?? myPos;

  function openFabMode(mode: 'rastro' | 'puesto') {
    setFabOpen(false);
    setPickedPos(null);
    if (!myPos) {
      pendingModeRef.current = mode;
      setFabMode(null);
      setPickingPos(true);
    } else {
      setFabMode(mode);
    }
  }

  function startPickOnMap(mode: 'rastro' | 'puesto') {
    pendingModeRef.current = mode;
    setFabMode(null);
    setPickingPos(true);
  }

  async function handleAddRastro() {
    if (!user || !effectivePos) return;
    setRastroLoading(true);
    try {
      await addRastro(batida.id, user.id, effectivePos.lat, effectivePos.lng, rastroEspecie, rastroAntiguedad, 0);
      refreshMapAnnotationsWithRetry();
    } catch (error) {
      if (isTransientNetworkError(error)) {
        enqueueOfflineAction({
          type: 'rastro_create',
          payload: {
            batidaId: batida.id,
            userId: user.id,
            lat: effectivePos.lat,
            lng: effectivePos.lng,
            especie: rastroEspecie,
            antiguedad: rastroAntiguedad,
          },
        });
        setGpsError('Sin conexión. Rastro guardado y pendiente de sincronización.');
      } else {
        setGpsError(getMutationErrorMessage('rastro', error));
      }
    }
    closeFabMode();
    setRastroLoading(false);
  }

  async function handleAddPuesto() {
    if (!effectivePos || !puestoNombre.trim()) return;
    setPuestoLoading(true);
    try {
      await addPuestoMapa(batida.id, puestoNombre.trim(), effectivePos.lat, effectivePos.lng);
      refreshMapAnnotationsWithRetry();
    } catch (error) {
      if (isTransientNetworkError(error)) {
        enqueueOfflineAction({
          type: 'puesto_create',
          payload: {
            batidaId: batida.id,
            nombre: puestoNombre.trim(),
            lat: effectivePos.lat,
            lng: effectivePos.lng,
          },
        });
        setGpsError('Sin conexión. Puesto guardado y pendiente de sincronización.');
      } else {
        setGpsError(getMutationErrorMessage('puesto', error));
      }
    }
    setPuestoNombre('');
    closeFabMode();
    setPuestoLoading(false);
  }

  async function handleSendSOS() {
    if (!user || sosLoading) return;
    setSosLoading(true);
    try {
      await unlockSosAudio();
      playSosAlarm();

      // Mantener solo un SOS activo por usuario: limpiar SOS previos antes de crear uno nuevo.
      const existing = await getMensajes(batida.id);
      const myExistingSos = existing.filter((msg) => msg.user_id === user.id && isSosMessage(msg));
      if (myExistingSos.length > 0) {
        await Promise.all(myExistingSos.map((msg) => deleteMensaje(msg.id)));
      }

      let lat = myPos?.lat;
      let lng = myPos?.lng;
      if (lat == null || lng == null) {
        const current = await getNativePosition();
        lat = current.lat;
        lng = current.lng;
      }

      const nombre = perfil?.nombre_completo || 'Cazador';
      const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
      const text = `🚨 SOS DE SEGURIDAD\\n${nombre} solicita ayuda inmediata.\\n📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}\\n🧭 ${mapsLink}`;

      try {
        await addMensaje(batida.id, user.id, text);
        const pushResult = await notifySosPush(batida.id, user.id, text, lat, lng);
        getMensajes(batida.id).then((data) => setSosMensajes(data.filter(isSosMessage)));

        if (!pushResult.ok) {
          const detail = pushResult.detail?.trim();
          setGpsError(detail
            ? `SOS enviado al chat, pero el push fallo: ${detail}`
            : 'SOS enviado al chat, pero el push no pudo enviarse.');
          return;
        }

        if ((pushResult.sent ?? 0) === 0) {
          setGpsError('SOS enviado al chat, pero no se entrego push a destinatarios.');
          return;
        }
      } catch {
        enqueueOfflineAction({
          type: 'sos_message',
          payload: { batidaId: batida.id, userId: user.id, mensaje: text },
        });
        setGpsError('Sin conexión. SOS guardado y se enviará al recuperar internet.');
        return;
      }

      setGpsError('SOS enviado al chat de la batida.');
    } catch {
      setGpsError('No se pudo enviar SOS. Comprueba GPS y conexión.');
    } finally {
      setSosLoading(false);
    }
  }

  async function handleCancelSOS() {
    if (!user || sosLoading) return;
    setSosLoading(true);
    try {
      const existing = await getMensajes(batida.id);
      const myExistingSos = existing.filter((msg) => msg.user_id === user.id && isSosMessage(msg));
      if (myExistingSos.length === 0) {
        setGpsError('No tienes SOS activo para cancelar.');
        return;
      }
      await Promise.all(myExistingSos.map((msg) => deleteMensaje(msg.id)));
      setSosMensajes((prev) => prev.filter((msg) => msg.user_id !== user.id));
      setGpsError('SOS cancelado correctamente.');
    } catch {
      setGpsError('No se pudo cancelar el SOS. Intenta de nuevo.');
    } finally {
      setSosLoading(false);
    }
  }

  const mySosActive = sosMensajes.some((msg) => msg.user_id === user?.id);
  const currentOfflineStats = offlineStats[mapLayerKind];

  function centerOnMe() {
    if (myPos && mapRef.current) {
      mapRef.current.setView([myPos.lat, myPos.lng], 16);
    } else {
      sendMyPosition(true);
    }
  }

  return (
    <div className="relative w-full h-full">
      {/* Map */}
      <div ref={mapDivRef} className="w-full h-full" />

      {/* GPS + SOS + Filtros */}
      <div className="absolute top-3 left-3 right-3 z-[999] flex flex-col gap-2">
        <div className="flex items-stretch gap-2">
          <button
            onClick={mySosActive ? handleCancelSOS : handleSendSOS}
            disabled={sosLoading}
            className={`h-10 px-3 rounded-xl shadow-lg text-xs font-black flex items-center gap-1.5 transition-all duration-200 disabled:opacity-60 border shrink-0 ${mySosActive ? 'bg-gray-700/95 hover:bg-gray-600 text-white border-gray-400/50' : 'bg-red-700/95 hover:bg-red-600 text-white border-red-400/50'}`}
          >
            {sosLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Siren className="w-4 h-4" />}
            {mySosActive ? 'Cancelar SOS' : 'SOS'}
          </button>

          <div className="h-10 bg-forest-dark/95 backdrop-blur border-2 border-amber/40 rounded-xl px-2 shadow-lg min-w-[132px] flex items-center gap-1.5 shrink-0">
            <span className="text-amber text-[10px] font-black">⚡ GPS</span>
            <select
              value={gpsInterval}
              onChange={(e) => {
                const next = Number(e.target.value);
                setGpsInterval(next);
                setGpsActive(next !== 0);
              }}
              className="flex-1 h-7 bg-forest border-2 border-forest-border rounded-md px-1.5 text-[10px] text-amber font-black outline-none focus:border-amber"
            >
              {GPS_INTERVALS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen(prev => !prev)}
            className="h-10 px-3 rounded-xl bg-forest-dark/95 backdrop-blur border-2 border-amber/40 hover:border-amber text-amber font-black text-[10px] transition-all flex items-center justify-between gap-2 min-w-[92px] shrink-0"
          >
            <span>🎯 Filtros</span>
            <span className="text-xs">{filtersOpen ? '−' : '+'}</span>
          </button>
        </div>

        {/* Filters */}
        {filtersOpen && (
          <div className="bg-forest-dark/95 backdrop-blur border-2 border-amber/40 rounded-xl p-2.5 shadow-lg text-xs w-full max-w-[340px]">
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setShowYo(prev => !prev)}
                  className={`text-[10px] py-1.5 rounded-md font-black transition-all border-2 leading-none ${showYo ? 'bg-green-500/90 border-green-400 text-forest-dark shadow-lg' : 'bg-forest border-forest-border text-white hover:border-green-500/60'}`}>
                  👤 Yo
                </button>
                <button type="button" onClick={() => setShowPerreros(prev => !prev)}
                  className={`text-[10px] py-1.5 rounded-md font-black transition-all border-2 leading-none ${showPerreros ? 'bg-orange-500/90 border-orange-400 text-forest-dark shadow-lg' : 'bg-forest border-forest-border text-white hover:border-orange-500/60'}`}>
                  🐕 Perreros
                </button>
                <button type="button" onClick={() => setShowPosturas(prev => !prev)}
                  className={`text-[10px] py-1.5 rounded-md font-black transition-all border-2 leading-none ${showPosturas ? 'bg-blue-500/90 border-blue-400 text-forest-dark shadow-lg' : 'bg-forest border-forest-border text-white hover:border-blue-500/60'}`}>
                  🎯 Posturas
                </button>
                <button type="button" onClick={() => setShowRastros(prev => !prev)}
                  className={`text-[10px] py-1.5 rounded-md font-black transition-all border-2 leading-none ${showRastros ? 'bg-violet-500/90 border-violet-400 text-forest-dark shadow-lg' : 'bg-forest border-forest-border text-white hover:border-violet-500/60'}`}>
                  🐾 Rastros
                </button>
                <button type="button" onClick={() => setShowTracks(prev => !prev)}
                  className={`text-[10px] py-1.5 rounded-md font-black transition-all border-2 leading-none ${showTracks ? 'bg-cyan-500/90 border-cyan-400 text-forest-dark shadow-lg' : 'bg-forest border-forest-border text-white hover:border-cyan-500/60'}`}>
                  🛤️ Rutas
                </button>
                <button type="button" onClick={() => setShowAlertas(prev => !prev)}
                  className={`text-[10px] py-1.5 rounded-md font-black transition-all border-2 leading-none ${showAlertas ? 'bg-red-500/90 border-red-400 text-forest-dark shadow-lg' : 'bg-forest border-forest-border text-white hover:border-red-500/60'}`}>
                  🚨 Alertas
                </button>
                <button type="button" onClick={() => setShowPuestos(prev => !prev)}
                  className={`text-[10px] py-1.5 rounded-md font-black transition-all border-2 leading-none ${showPuestos ? 'bg-amber/90 border-amber text-forest-dark shadow-lg' : 'bg-forest border-forest-border text-white hover:border-amber/60'}`}>
                  📍 Puestos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GPS Error banner */}
      {gpsError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] w-[85vw] max-w-sm bg-red-900/95 border-2 border-red-500/60 rounded-2xl px-5 py-4 flex items-start gap-3 shadow-xl backdrop-blur-sm">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0 font-black" />
          <div className="flex-1">
            <p className="text-red-200 text-xs leading-relaxed font-medium">{gpsError}</p>
          </div>
          <button onClick={() => setGpsError(null)} className="text-red-400 hover:text-white ml-2 font-black text-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Pick position banner */}
      {pickingPos && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] bg-forest-dark/95 border-2 border-amber text-amber text-base font-black px-6 py-4 rounded-2xl shadow-xl backdrop-blur-sm">
          🎯 Toca el mapa para marcar la posición
        </div>
      )}

      {offlinePickMode && (
        <div className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] bg-forest-dark/95 border-2 border-cyan-400 text-cyan-200 text-sm font-black px-5 py-3 rounded-2xl shadow-xl backdrop-blur-sm">
          {offlineSelectionStep === 'first' && '🗺️ Añade el primer punto'}
          {offlineSelectionStep === 'second' && '🗺️ Añade el segundo punto...'}
          {offlineSelectionStep === 'confirm' && '🗺️ Zona dibujada. Pulsa "Confirmar mapa"'}
        </div>
      )}

      {offlinePickMode && offlinePendingBounds && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1002] flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              offlineSelectionStartRef.current = null;
              setOfflinePendingBounds(null);
              setOfflineSelectionStep('first');
              if (offlineAreaLayerRef.current) {
                offlineAreaLayerRef.current.clearLayers();
              }
              setOfflineInfo('Añade el primer punto');
            }}
            className="px-4 py-2 rounded-xl border-2 border-amber/70 text-amber bg-forest-dark/90 text-sm font-black"
          >
            Repetir
          </button>
          <button
            type="button"
            onClick={() => {
              setOfflineBounds(offlinePendingBounds);
              setOfflinePickMode(false);
              setMapLayersOpen(true);
              setOfflineInfo('Zona seleccionada. Ya puedes descargar mapas offline.');
              setOfflineSelectionStep('first');
              setOfflinePendingBounds(null);
              offlineSelectionStartRef.current = null;
            }}
            className="px-4 py-2 rounded-xl border-2 border-cyan-400 text-cyan-100 bg-cyan-700/70 text-sm font-black"
          >
            Confirmar mapa
          </button>
        </div>
      )}

      {/* Center on me */}
      {!offlinePickMode && (
        <button onClick={centerOnMe}
          className="absolute bottom-3.5 right-3.5 z-[999] w-11 h-11 bg-forest-dark/90 rounded-full flex items-center justify-center shadow-xl border-2 border-amber text-amber hover:bg-forest-dark hover:border-amber-light transition-all">
          {gpsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crosshair className="w-5 h-5" />}
        </button>
      )}

      {/* FAB */}
      {!offlinePickMode && (
      <div className="absolute bottom-20 right-3.5 z-[999] flex flex-col-reverse items-end gap-2.5">
        {fabOpen && (
          <>
            <button onClick={() => openFabMode('rastro')}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-black transition-all duration-200">
              <Navigation className="w-4 h-4" />
              Rastro
            </button>
            {isAdmin && (
              <button onClick={() => openFabMode('puesto')}
                className="flex items-center gap-2 bg-gradient-to-r from-amber to-amber-light hover:from-amber-light hover:to-amber text-forest-dark px-4 py-2.5 rounded-xl shadow-lg text-sm font-black transition-all duration-200">
                <MapPin className="w-4 h-4" />
                Puesto
              </button>
            )}
          </>
        )}
        <button onClick={() => setFabOpen(!fabOpen)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 font-black ${fabOpen ? 'bg-red-600 rotate-45 border-2 border-red-500' : 'bg-gradient-to-br from-amber to-amber-light border-2 border-amber-light'}`}>
          <Plus className={`w-6 h-6 ${fabOpen ? 'text-white' : 'text-forest-dark'}`} />
        </button>
      </div>
      )}

      {/* Rastro Modal */}
      {fabMode === 'rastro' && (
        <div className="absolute inset-0 z-[1000] flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeFabMode} />
          <div className="relative w-full bg-gradient-to-br from-forest-dark to-forest-dark/90 rounded-t-3xl p-6 space-y-5 border-t-2 border-red-600">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-black text-xl">🐾 Nuevo rastro</h3>
              <button onClick={closeFabMode} className="text-amber hover:text-amber-light p-1"><X className="w-6 h-6 font-black" /></button>
            </div>

            {/* Position status */}
            <div className="flex items-center gap-2.5">
              {effectivePos ? (
                <span className="text-xs text-green-300 bg-green-900/40 border-2 border-green-600/60 px-4 py-2.5 rounded-xl font-bold">
                  ✓ Posición lista ({effectivePos === pickedPos ? 'del mapa' : 'GPS'})
                </span>
              ) : (
                <span className="text-xs text-amber bg-amber/10 border-2 border-amber/40 px-4 py-2.5 rounded-xl font-bold">
                  ⚠️ Sin posición — usa GPS o el mapa
                </span>
              )}
              <button
                onClick={() => startPickOnMap('rastro')}
                className="text-xs text-amber font-black hover:text-amber-light">
                Elegir en mapa →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-amber font-black mb-2.5">Especie</label>
                <select value={rastroEspecie} onChange={e => setRastroEspecie(e.target.value as EspecieRastro)}
                  className="w-full bg-forest-dark border-2 border-forest-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber transition-all font-medium">
                  {(Object.entries(ESPECIE_RASTRO_LABELS) as [EspecieRastro, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-amber font-black mb-2.5">Antigüedad</label>
                <select value={rastroAntiguedad} onChange={e => setRastroAntiguedad(e.target.value as AntiguedadRastro)}
                  className="w-full bg-forest-dark border-2 border-forest-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber transition-all font-medium">
                  {(Object.entries(ANTIGUEDAD_LABELS) as [AntiguedadRastro, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={handleAddRastro} disabled={rastroLoading || !effectivePos}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-lg">
              {rastroLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
              Marcar rastro
            </button>
          </div>
        </div>
      )}

      {/* Puesto Modal */}
      {fabMode === 'puesto' && (
        <div className="absolute inset-0 z-[1000] flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeFabMode} />
          <div className="relative w-full bg-gradient-to-br from-forest-dark to-forest-dark/90 rounded-t-3xl p-6 space-y-5 border-t-2 border-amber">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-black text-xl">📍 Nuevo puesto</h3>
              <button onClick={closeFabMode} className="text-amber hover:text-amber-light p-1"><X className="w-6 h-6 font-black" /></button>
            </div>

            {/* Position status */}
            <div className="flex items-center gap-2.5">
              {effectivePos ? (
                <span className="text-xs text-green-300 bg-green-900/40 border-2 border-green-600/60 px-4 py-2.5 rounded-xl font-bold">
                  ✓ Posición lista ({effectivePos === pickedPos ? 'del mapa' : 'GPS'})
                </span>
              ) : (
                <span className="text-xs text-amber bg-amber/10 border-2 border-amber/40 px-4 py-2.5 rounded-xl font-bold">
                  ⚠️ Sin posición — usa GPS o el mapa
                </span>
              )}
              <button
                onClick={() => startPickOnMap('puesto')}
                className="text-xs text-amber font-black hover:text-amber-light">
                Elegir en mapa →
              </button>
            </div>

            <div>
              <label className="block text-sm text-amber font-black mb-2.5">Nombre del puesto</label>
              <input value={puestoNombre} onChange={e => setPuestoNombre(e.target.value)} placeholder="Ej: Robledal, Vega del Río..."
                className="w-full bg-forest-dark border-2 border-forest-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all font-medium" />
            </div>
            <button onClick={handleAddPuesto} disabled={puestoLoading || !puestoNombre.trim() || !effectivePos}
              className="w-full bg-gradient-to-r from-amber to-amber-light hover:from-amber-light hover:to-amber text-forest-dark font-black py-4 rounded-2xl transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-lg">
              {puestoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              Marcar puesto
            </button>
          </div>
        </div>
      )}

      {/* Send GPS button */}
      {!offlinePickMode && (
        <button onClick={() => sendMyPosition(true)} disabled={gpsLoading}
          className="absolute bottom-2.5 left-3 z-[999] bg-green-700/90 hover:bg-green-600 text-white px-3.5 py-2 rounded-xl shadow-lg text-xs font-black flex items-center gap-1.5 transition-all duration-200 disabled:opacity-60">
          {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          Enviar GPS
        </button>
      )}

      {/* Rastros count badge */}
      {!offlinePickMode && (
        <div className="absolute top-3.5 right-3.5 z-[999] flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setMapLayersOpen(prev => !prev)}
            className="w-11 h-11 rounded-full bg-forest-dark/95 border-2 border-amber text-amber hover:text-amber-light hover:border-amber-light flex items-center justify-center shadow-xl transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
            </svg>
          </button>
          {mapLayersOpen && (
          <div className="w-72 max-h-[68vh] overflow-y-auto pr-1 bg-forest-dark/95 border-2 border-amber/40 rounded-2xl p-3 shadow-2xl backdrop-blur-sm space-y-2.5">
            <p className="text-[11px] text-amber font-black uppercase tracking-wide">Capas del mapa</p>
            {([
              { kind: 'satellite', label: 'Satélite' },
              { kind: 'hybrid', label: 'Satélite híbrido' },
              { kind: 'streets', label: 'Calles' },
            ] as const).map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                onClick={() => applyMapLayer(kind)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-black transition-all ${mapLayerKind === kind ? 'bg-amber text-forest-dark border-amber' : 'bg-forest border-forest-border text-white hover:border-amber/60'}`}
              >
                {label}
              </button>
            ))}

            <div className="pt-1 border-t border-forest-border space-y-2.5">
              <p className="text-[11px] text-cyan-300 font-black uppercase tracking-wide">Mapa offline</p>

              <div className="text-[11px] text-forest-muted">
                Cache capa actual: <span className="text-white font-black">{currentOfflineStats.tiles}</span> teselas · <span className="text-white font-black">{formatBytes(currentOfflineStats.bytes)}</span>
              </div>

              <div>
                <label className="block text-[10px] text-forest-muted font-black mb-1">Nombre del mapa offline</label>
                <input
                  type="text"
                  value={offlineMapName}
                  onChange={(e) => setOfflineMapName(e.target.value)}
                  placeholder="Ej: Sierra Norte Satélite"
                  className="w-full bg-forest border-2 border-forest-border rounded-lg px-2 py-1.5 text-xs text-white font-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-forest-muted font-black mb-1">Zoom min</label>
                  <input
                    type="number"
                    min={10}
                    max={18}
                    value={offlineMinZoom}
                    onChange={(e) => {
                      const nextMin = Math.max(10, Math.min(18, Number(e.target.value) || 10));
                      setOfflineMinZoom(nextMin);
                      if (nextMin > offlineMaxZoom) setOfflineMaxZoom(nextMin);
                    }}
                    className="w-full bg-forest border-2 border-forest-border rounded-lg px-2 py-1.5 text-xs text-white font-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-forest-muted font-black mb-1">Zoom max</label>
                  <input
                    type="number"
                    min={10}
                    max={19}
                    value={offlineMaxZoom}
                    onChange={(e) => {
                      const nextMax = Math.max(10, Math.min(19, Number(e.target.value) || 10));
                      setOfflineMaxZoom(nextMax);
                      if (nextMax < offlineMinZoom) setOfflineMinZoom(nextMax);
                    }}
                    className="w-full bg-forest border-2 border-forest-border rounded-lg px-2 py-1.5 text-xs text-white font-black"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMapLayersOpen(false);
                  offlineSelectionStartRef.current = null;
                  setOfflinePendingBounds(null);
                  setOfflineSelectionStep('first');
                  if (offlineAreaLayerRef.current) {
                    offlineAreaLayerRef.current.clearLayers();
                  }
                  setOfflinePickMode(true);
                  setOfflineInfo('Añade el primer punto');
                }}
                className="w-full px-3 py-2 rounded-xl border-2 border-cyan-500/60 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/10 text-xs font-black transition-all"
              >
                Seleccionar zona en mapa
              </button>

              <div className="text-[11px] text-forest-muted">
                Zona: {offlineBounds ? 'seleccionada' : 'sin seleccionar'} · Estimado: <span className="text-white font-black">{offlineEstimatedTiles}</span> teselas
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadOfflineArea}
                  disabled={!offlineBounds || offlineDownloading}
                  className="px-3 py-2 rounded-xl border-2 border-green-500/60 text-green-200 hover:border-green-400 hover:bg-green-500/10 text-xs font-black transition-all disabled:opacity-50"
                >
                  {offlineDownloading ? 'Descargando...' : 'Descargar'}
                </button>
                <button
                  type="button"
                  onClick={clearOfflineSelection}
                  disabled={offlineDownloading}
                  className="px-3 py-2 rounded-xl border-2 border-amber/60 text-amber hover:border-amber-light hover:bg-amber/10 text-xs font-black transition-all disabled:opacity-50"
                >
                  Limpiar zona
                </button>
              </div>

              <button
                type="button"
                onClick={handleClearOfflineForCurrentLayer}
                disabled={offlineDownloading}
                className="w-full px-3 py-2 rounded-xl border-2 border-red-500/60 text-red-200 hover:border-red-400 hover:bg-red-500/10 text-xs font-black transition-all disabled:opacity-50"
              >
                Borrar cache de esta capa
              </button>

              {offlineDownloadProgress.total > 0 && (
                <div className="text-[11px] text-forest-muted">
                  Progreso: <span className="text-white font-black">{offlineDownloadProgress.downloaded}</span> / {offlineDownloadProgress.total} · Fallidas: {offlineDownloadProgress.failed}
                </div>
              )}

              {offlineInfo && (
                <div className="text-[11px] text-cyan-100 bg-cyan-950/40 border border-cyan-800/60 rounded-lg px-2 py-2">
                  {offlineInfo}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}