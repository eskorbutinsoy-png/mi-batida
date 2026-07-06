import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Footprints, ArrowLeft, Trash2, MapPin, Crosshair, List, Check, X,
  MessageCircle, Map as MapIcon, Send, Camera, CheckCircle2, Radio, RefreshCw, Image as ImageIcon,
} from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { rastreosDB, rastreoPuntosDB } from '../lib/db';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Rastreo, RastreoPunto } from '../lib/types';
import { AnimalIcon, ANIMALES, ANIMAL_IMGS, type AnimalType } from './rastreos/AnimalIcons';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Participante {
  id: string;
  rastreo_id: string;
  user_id: string;
  nombre: string;
  lat: number | null;
  lng: number | null;
  color: string;
  last_seen: string;
}

interface Mensaje {
  id: string;
  rastreo_id: string;
  user_id: string;
  nombre: string;
  texto: string;
  foto: string;
  created_at: string;
}

const PART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4'];

// ─── Direction helpers ────────────────────────────────────────────────────────

function getCardinalLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

// ─── Leaflet setup ───────────────────────────────────────────────────────────

let leafletCssLoaded = false;
function ensureLeafletCss() {
  if (leafletCssLoaded) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  leafletCssLoaded = true;
}

function buildMarkerSvg(_animal: AnimalType, color: string, imgUrl: string, direccion?: number | null): string {
  const arrowSvg = direccion != null
    ? `<g transform="rotate(${direccion}, 18, 18)">
        <polygon points="18,-8 13,5 23,5" fill="white" stroke="rgba(0,0,0,0.3)" stroke-width="0.8" stroke-linejoin="round"/>
        <rect x="16" y="5" width="4" height="14" rx="2" fill="white" opacity="0.92"/>
      </g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-4 -14 44 60" width="44" height="60">
    <circle cx="18" cy="18" r="17" fill="${color}" opacity="0.95"/>
    <image href="${imgUrl}" x="2" y="2" width="32" height="32" style="mix-blend-mode:multiply"/>
    ${arrowSvg}
    <path d="M18 38 L12 26 Q18 30 24 26Z" fill="${color}"/>
  </svg>`;
}

function buildPersonSvg(color: string, letra: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 44" width="36" height="44">
    <circle cx="18" cy="15" r="14" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="18" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="sans-serif">${letra}</text>
    <path d="M18 40 L12 28 Q18 32 24 28Z" fill="${color}"/>
  </svg>`;
}

// Arrow SVG rendered as Leaflet marker during direction-picking
// Center at (80,80); tip at y=6 = 74px above anchor → extends well past the 42px-tall animal marker
function buildDirectionArrowSvg(angle: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <g transform="rotate(${Math.round(angle)}, 80, 80)">
      <polygon points="80,6 63,46 80,34 97,46" fill="white" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="75" y="34" width="10" height="52" rx="5" fill="white" opacity="0.92"/>
      <circle cx="80" cy="80" r="8" fill="#3b82f6" stroke="white" stroke-width="3"/>
    </g>
  </svg>`;
}

// ─── LiveMap ─────────────────────────────────────────────────────────────────

interface LiveMapProps {
  puntos: RastreoPunto[];
  participantes: Participante[];
  myUserId: string;
  centerOnGps: boolean;
  onGpsPosition: (lat: number, lng: number) => void;
  onGpsError: (msg: string) => void;
  externalGpsPos?: { lat: number; lng: number } | null;
  onCrosshairClick: () => void;
  pendingPunto?: RastreoPunto | null;
  arrowAngle?: number;
  onArrowAngleChange?: (deg: number) => void;
}

function LiveMap({ puntos, participantes, myUserId, centerOnGps, onGpsPosition, onGpsError, externalGpsPos, onCrosshairClick, pendingPunto, arrowAngle, onArrowAngleChange }: LiveMapProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const myDotRef = useRef<any>(null);
  const partMarkersRef = useRef<Map<string, any>>(new Map());
  const centeredRef = useRef(false);
  const arrowMarkerRef = useRef<any>(null);
  // Store a stable ref to callback to avoid re-attaching touch listeners every render
  const onArrowAngleChangeRef = useRef(onArrowAngleChange);
  useEffect(() => { onArrowAngleChangeRef.current = onArrowAngleChange; }, [onArrowAngleChange]);

  const renderAnimalMarkers = (L: any) => {
    if (!mapRef.current) return;
    mapRef.current.eachLayer((layer: any) => {
      if (layer._isAnimalMarker) mapRef.current.removeLayer(layer);
    });
    puntos.forEach(p => {
      const animal = p.animal as AnimalType;
      const animalDef = ANIMALES.find(a => a.value === animal) || ANIMALES[0];
      const svg = buildMarkerSvg(animal, animalDef.markerColor, ANIMAL_IMGS[animal], p.direccion);
      const icon = L.divIcon({ html: svg, className: '', iconSize: [44, 60], iconAnchor: [22, 60], popupAnchor: [0, -60] });
      const marker = L.marker([p.latitud, p.longitud], { icon });
      (marker as any)._isAnimalMarker = true;
      const dirLabel = p.direccion != null ? `<br><span style="color:#888;font-size:11px">&#8594; ${getCardinalLabel(p.direccion)} (${p.direccion}°)</span>` : '';
      marker.bindPopup(`<div style="font-family:sans-serif;font-size:13px"><b>${animalDef.label}</b>${dirLabel}${p.notas ? `<br><span style="color:#666">${p.notas}</span>` : ''}</div>`);
      marker.addTo(mapRef.current);
    });
  };

  const renderParticipantes = (L: any) => {
    if (!mapRef.current) return;
    participantes.forEach(p => {
      if (!p.lat || !p.lng || p.user_id === myUserId) return;
      const letra = p.nombre.charAt(0).toUpperCase();
      const svg = buildPersonSvg(p.color, letra);
      const icon = L.divIcon({ html: svg, className: '', iconSize: [36, 44], iconAnchor: [18, 44], popupAnchor: [0, -44] });
      const existing = partMarkersRef.current.get(p.user_id);
      if (existing) {
        existing.setLatLng([p.lat, p.lng]);
        existing.setPopupContent(`<b>${p.nombre}</b>`);
      } else {
        const marker = L.marker([p.lat, p.lng], { icon, zIndexOffset: 500 });
        marker.bindPopup(`<b>${p.nombre}</b>`);
        marker.addTo(mapRef.current);
        partMarkersRef.current.set(p.user_id, marker);
      }
    });
    const userIds = new Set(participantes.map(p => p.user_id));
    partMarkersRef.current.forEach((marker, uid) => {
      if (!userIds.has(uid)) {
        mapRef.current.removeLayer(marker);
        partMarkersRef.current.delete(uid);
      }
    });
  };

  // Refresh animal markers when puntos/participantes change
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(L => {
      renderAnimalMarkers(L);
      renderParticipantes(L);
    });
  }, [puntos, participantes]);

  // GPS dot
  useEffect(() => {
    if (!mapRef.current || !externalGpsPos) return;
    import('leaflet').then(L => {
      const GPS_DOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#3b82f6" opacity="0.25"/><circle cx="12" cy="12" r="6" fill="#3b82f6" opacity="0.5"/><circle cx="12" cy="12" r="4" fill="#60a5fa"/></svg>`;
      const dotIcon = L.divIcon({ html: GPS_DOT_SVG, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
      if (myDotRef.current) {
        myDotRef.current.setLatLng([externalGpsPos.lat, externalGpsPos.lng]);
      } else {
        myDotRef.current = L.marker([externalGpsPos.lat, externalGpsPos.lng], { icon: dotIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
      }
      if (!centeredRef.current) {
        mapRef.current.setView([externalGpsPos.lat, externalGpsPos.lng], 16);
        centeredRef.current = true;
      }
    });
  }, [externalGpsPos]);

  // Arrow marker: mount/unmount when pendingPunto changes, center map on it
  useEffect(() => {
    import('leaflet').then(L => {
      if (!mapRef.current) return;
      if (pendingPunto) {
        const svg = buildDirectionArrowSvg(arrowAngle ?? 0);
        const icon = L.divIcon({ html: svg, className: '', iconSize: [160, 160], iconAnchor: [80, 80] });
        if (arrowMarkerRef.current) {
          mapRef.current.removeLayer(arrowMarkerRef.current);
        }
        arrowMarkerRef.current = L.marker([pendingPunto.latitud, pendingPunto.longitud], {
          icon, zIndexOffset: 2000, interactive: false,
        }).addTo(mapRef.current);
        // Center map on the punto at a close zoom
        mapRef.current.setView([pendingPunto.latitud, pendingPunto.longitud], Math.max(mapRef.current.getZoom(), 17));
        mapRef.current.dragging.disable();
      } else {
        if (arrowMarkerRef.current && mapRef.current) {
          mapRef.current.removeLayer(arrowMarkerRef.current);
          arrowMarkerRef.current = null;
        }
        mapRef.current.dragging.enable();
      }
    });
  }, [pendingPunto]);

  // Arrow icon update when angle changes
  useEffect(() => {
    if (!arrowMarkerRef.current || !pendingPunto) return;
    import('leaflet').then(L => {
      if (!arrowMarkerRef.current) return;
      const svg = buildDirectionArrowSvg(arrowAngle ?? 0);
      const icon = L.divIcon({ html: svg, className: '', iconSize: [160, 160], iconAnchor: [80, 80] });
      arrowMarkerRef.current.setIcon(icon);
    });
  }, [arrowAngle, pendingPunto]);

  // Touch + mouse rotation: interact anywhere on the map → arrow points from punto center toward pointer
  useEffect(() => {
    if (!pendingPunto || !divRef.current || !mapRef.current) return;
    const mapDiv = divRef.current;

    const getPointCenter = () => {
      if (!mapRef.current || !divRef.current) return null;
      const pt = mapRef.current.latLngToContainerPoint([pendingPunto.latitud, pendingPunto.longitud]);
      const rect = divRef.current.getBoundingClientRect();
      return { x: rect.left + pt.x, y: rect.top + pt.y };
    };

    const calcAngle = (clientX: number, clientY: number) => {
      const center = getPointCenter();
      if (!center) return 0;
      const dx = clientX - center.x;
      const dy = clientY - center.y;
      return ((Math.atan2(dx, -dy) * (180 / Math.PI)) + 360) % 360;
    };

    // Touch events (mobile)
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      onArrowAngleChangeRef.current?.(calcAngle(t.clientX, t.clientY));
    };

    // Mouse events (desktop previewer)
    let mouseDown = false;
    const handleMouseDown = (e: MouseEvent) => {
      mouseDown = true;
      onArrowAngleChangeRef.current?.(calcAngle(e.clientX, e.clientY));
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return;
      onArrowAngleChangeRef.current?.(calcAngle(e.clientX, e.clientY));
    };
    const handleMouseUp = () => { mouseDown = false; };

    mapDiv.addEventListener('touchstart', handleTouch, { passive: false });
    mapDiv.addEventListener('touchmove', handleTouch, { passive: false });
    mapDiv.addEventListener('mousedown', handleMouseDown);
    mapDiv.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      mapDiv.removeEventListener('touchstart', handleTouch);
      mapDiv.removeEventListener('touchmove', handleTouch);
      mapDiv.removeEventListener('mousedown', handleMouseDown);
      mapDiv.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [pendingPunto]);

  // Initial map setup
  useEffect(() => {
    ensureLeafletCss();
    if (!divRef.current || mapRef.current) return;

    import('leaflet').then(L => {
      if (!divRef.current || mapRef.current) return;
      const map = L.map(divRef.current, { zoomControl: false, attributionControl: false });
      mapRef.current = map;
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: 'topright' }).addTo(map);
      map.setView([40.416775, -3.70379], 6);
      setTimeout(() => { map.invalidateSize(); }, 100);

      if (centerOnGps && !centeredRef.current) {
        (async () => {
          try {
            let status = await Geolocation.checkPermissions();
            if (status.location !== 'granted') status = await Geolocation.requestPermissions({ permissions: ['location'] });
            if (status.location !== 'granted') { onGpsError('Permiso de ubicación no concedido.'); return; }
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
            const { latitude: lat, longitude: lng } = pos.coords;
            if (!mapRef.current) return;
            centeredRef.current = true;
            map.setView([lat, lng], 16);
            const GPS_DOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#3b82f6" opacity="0.25"/><circle cx="12" cy="12" r="6" fill="#3b82f6" opacity="0.5"/><circle cx="12" cy="12" r="4" fill="#60a5fa"/></svg>`;
            const dotIcon = L.divIcon({ html: GPS_DOT_SVG, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
            myDotRef.current = L.marker([lat, lng], { icon: dotIcon, zIndexOffset: 1000 }).addTo(map);
            onGpsPosition(lat, lng);
          } catch {
            onGpsError('No se pudo obtener el GPS. Asegúrate de tener la ubicación activa.');
          }
        })();
      }
      renderAnimalMarkers(L);
    });

    return () => {
      partMarkersRef.current.clear();
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  const recenter = () => {
    if (externalGpsPos && mapRef.current) {
      mapRef.current.setView([externalGpsPos.lat, externalGpsPos.lng], 16);
    } else {
      onCrosshairClick();
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
      {!pendingPunto && (
        <button
          onClick={recenter}
          className="absolute right-3 bottom-4 w-12 h-12 rounded-full bg-blue-700 shadow-xl border-2 border-blue-400/50 flex items-center justify-center text-white z-10"
        >
          <Crosshair size={22} />
        </button>
      )}
    </div>
  );
}

// ─── Chat compress helper ─────────────────────────────────────────────────────

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 480;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.55));
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RastreosSection({ perreraId }: { perreraId: string }) {
  const { user, nombreCompleto } = useAuth();

  const [rastreos, setRastreos] = useState<Rastreo[]>([]);
  const [activos, setActivos] = useState<Rastreo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'newrastreo' | 'rastreo' | 'listpuntos'>('list');
  const [activeRastreo, setActiveRastreo] = useState<Rastreo | null>(null);
  const [puntos, setPuntos] = useState<RastreoPunto[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [tab, setTab] = useState<'mapa' | 'chat'>('mapa');
  const [unreadChat, setUnreadChat] = useState(0);

  // Form nuevo rastreo
  const [newNombre, setNewNombre] = useState('');
  const [newFecha, setNewFecha] = useState(new Date().toISOString().split('T')[0]);

  // Punto GPS
  const [animalSeleccionado, setAnimalSeleccionado] = useState<AnimalType>('jabali');
  const [puntoNotas, setPuntoNotas] = useState('');
  const [gpsActual, setGpsActual] = useState<{ lat: number; lng: number } | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAnimalPanel, setShowAnimalPanel] = useState(false);

  // Dirección interactiva
  const [pendingDirPunto, setPendingDirPunto] = useState<RastreoPunto | null>(null);
  const [arrowAngle, setArrowAngle] = useState(0);

  // Chat
  const [chatText, setChatText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Realtime
  const channelRef = useRef<any>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myColor = useRef(PART_COLORS[0]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      const { data: all } = await supabase
        .from('rastreos')
        .select('*')
        .eq('perrera_id', perreraId)
        .order('created_at', { ascending: false });
      const rows = (all ?? []) as (Rastreo & { estado: string })[];
      setActivos(rows.filter(r => r.estado === 'activo'));
      setRastreos(rows.filter(r => r.estado !== 'activo'));
    } catch {}
    setLoaded(true);
  }, [perreraId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Open/join rastreo ─────────────────────────────────────────────────────

  const openRastreo = useCallback(async (r: Rastreo) => {
    setActiveRastreo(r);
    setPuntos([]);
    setParticipantes([]);
    setMensajes([]);
    setTab('mapa');
    setUnreadChat(0);
    setShowAnimalPanel(false);
    setGpsActual(null);
    setGpsError('');
    setPendingDirPunto(null);
    setArrowAngle(0);

    const [{ data: pts }, { data: parts }, { data: msgs }] = await Promise.all([
      supabase.from('rastreo_puntos').select('*').eq('rastreo_id', r.id).order('created_at'),
      supabase.from('rastreo_participantes').select('*').eq('rastreo_id', r.id),
      supabase.from('rastreo_mensajes').select('*').eq('rastreo_id', r.id).order('created_at'),
    ]);
    setPuntos((pts ?? []) as RastreoPunto[]);
    setParticipantes((parts ?? []) as Participante[]);
    setMensajes((msgs ?? []) as Mensaje[]);

    const existingParts = (parts ?? []) as Participante[];
    const myExisting = existingParts.find(p => p.user_id === user?.id);
    if (myExisting) {
      myColor.current = myExisting.color;
    } else {
      myColor.current = PART_COLORS[existingParts.length % PART_COLORS.length];
    }

    if (user) {
      await supabase.from('rastreo_participantes').upsert(
        { rastreo_id: r.id, user_id: user.id, nombre: nombreCompleto || 'Tú', color: myColor.current, last_seen: new Date().toISOString() },
        { onConflict: 'rastreo_id,user_id' }
      );
    }

    const channel = supabase.channel(`rastreo-${r.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rastreo_participantes', filter: `rastreo_id=eq.${r.id}` }, payload => {
        if (payload.eventType === 'DELETE') {
          setParticipantes(prev => prev.filter(p => p.id !== (payload.old as any).id));
        } else {
          const p = payload.new as Participante;
          setParticipantes(prev => {
            const idx = prev.findIndex(x => x.user_id === p.user_id);
            return idx >= 0 ? prev.map((x, i) => i === idx ? p : x) : [...prev, p];
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rastreo_puntos', filter: `rastreo_id=eq.${r.id}` }, payload => {
        const pt = payload.new as RastreoPunto;
        setPuntos(prev => prev.map(x => x.id === pt.id ? x : x).concat(prev.some(x => x.id === pt.id) ? [] : [pt]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rastreo_puntos', filter: `rastreo_id=eq.${r.id}` }, payload => {
        const pt = payload.new as RastreoPunto;
        setPuntos(prev => prev.map(x => x.id === pt.id ? pt : x));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rastreo_mensajes', filter: `rastreo_id=eq.${r.id}` }, payload => {
        const msg = payload.new as Mensaje;
        setMensajes(prev => {
          // Replace optimistic placeholder if same user+texto+foto combo, otherwise just add if not already present
          const alreadyReal = prev.some(m => m.id === msg.id);
          if (alreadyReal) return prev;
          const tmpIdx = prev.findIndex(m => m.id.startsWith('tmp-') && m.user_id === msg.user_id && m.texto === msg.texto && m.foto === msg.foto);
          if (tmpIdx !== -1) {
            const next = [...prev];
            next[tmpIdx] = msg;
            return next;
          }
          return [...prev, msg];
        });
        setTab(current => {
          if (current !== 'chat') setUnreadChat(n => n + 1);
          return current;
        });
      })
      .subscribe();
    channelRef.current = channel;

    setView('rastreo');
  }, [user, nombreCompleto]);

  // ── GPS broadcast ────────────────────────────────────────────────────────

  const broadcastGps = useCallback(async (lat: number, lng: number) => {
    if (!user || !activeRastreo) return;
    await supabase.from('rastreo_participantes').upsert(
      { rastreo_id: activeRastreo.id, user_id: user.id, nombre: nombreCompleto || 'Tú', color: myColor.current, lat, lng, last_seen: new Date().toISOString() },
      { onConflict: 'rastreo_id,user_id' }
    );
  }, [user, activeRastreo, nombreCompleto]);

  useEffect(() => {
    if (view !== 'rastreo' || !activeRastreo) return;
    const interval = setInterval(async () => {
      try {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsActual({ lat, lng });
        broadcastGps(lat, lng);
      } catch {}
    }, 20000);
    gpsIntervalRef.current = interval;
    return () => { clearInterval(interval); };
  }, [view, activeRastreo, broadcastGps]);

  // ── Exit rastreo ─────────────────────────────────────────────────────────

  const exitRastreo = useCallback(async () => {
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    if (user && activeRastreo) {
      await supabase.from('rastreo_participantes').delete().eq('rastreo_id', activeRastreo.id).eq('user_id', user.id);
    }
    setActiveRastreo(null);
    setView('list');
    loadAll();
  }, [user, activeRastreo, loadAll]);

  const finalizarRastreo = useCallback(async () => {
    if (!activeRastreo) return;
    if (!confirm('¿Finalizar este rastreo? Se guardará y no se podrán añadir más puntos.')) return;
    await supabase.from('rastreos').update({ estado: 'finalizado' }).eq('id', activeRastreo.id);
    exitRastreo();
  }, [activeRastreo, exitRastreo]);

  // ── GPS controls ──────────────────────────────────────────────────────────

  const handleGpsPosition = useCallback((lat: number, lng: number) => {
    setGpsActual({ lat, lng });
    setGpsError('');
    broadcastGps(lat, lng);
  }, [broadcastGps]);

  const recentrarGps = useCallback(async () => {
    setGeolocating(true);
    setGpsError('');
    try {
      let status = await Geolocation.checkPermissions();
      if (status.location !== 'granted') status = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (status.location !== 'granted') { setGpsError('Permiso de ubicación no concedido.'); return; }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
      const { latitude: lat, longitude: lng } = pos.coords;
      setGpsActual({ lat, lng });
      broadcastGps(lat, lng);
    } catch {
      setGpsError('No se pudo obtener el GPS. Asegúrate de tener la ubicación activa.');
    } finally {
      setGeolocating(false);
    }
  }, [broadcastGps]);

  // ── Guardar punto (sin dirección aún) ────────────────────────────────────

  const guardarPuntoGps = useCallback(async () => {
    if (!gpsActual || !activeRastreo) return;
    setSaving(true);
    try {
      const { data: pt } = await supabase.from('rastreo_puntos').insert({
        perrera_id: perreraId,
        rastreo_id: activeRastreo.id,
        latitud: gpsActual.lat,
        longitud: gpsActual.lng,
        animal: animalSeleccionado,
        notas: puntoNotas.trim(),
        direccion: null,
      }).select().single();
      if (pt) {
        setPuntos(prev => [...prev, pt as RastreoPunto]);
        setPendingDirPunto(pt as RastreoPunto);
        setArrowAngle(0);
      }
      setPuntoNotas('');
      setShowAnimalPanel(false);
    } catch {}
    setSaving(false);
  }, [gpsActual, activeRastreo, perreraId, animalSeleccionado, puntoNotas]);

  // ── Confirmar dirección ───────────────────────────────────────────────────

  const confirmarDireccion = useCallback(async () => {
    if (!pendingDirPunto) return;
    const deg = Math.round(((arrowAngle % 360) + 360) % 360);
    await supabase.from('rastreo_puntos').update({ direccion: deg }).eq('id', pendingDirPunto.id);
    setPuntos(prev => prev.map(p => p.id === pendingDirPunto.id ? { ...p, direccion: deg } : p));
    setPendingDirPunto(null);
    await recentrarGps();
  }, [pendingDirPunto, arrowAngle, recentrarGps]);

  const saltarDireccion = useCallback(async () => {
    setPendingDirPunto(null);
    await recentrarGps();
  }, [recentrarGps]);

  // ── Chat ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (tab === 'chat') {
      setUnreadChat(0);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [tab, mensajes]);

  const sendMessage = useCallback(async (texto: string, foto = '') => {
    if (!user || !activeRastreo || (!texto.trim() && !foto)) return;
    // Optimistic insert — show immediately, dedup later when realtime fires
    const tempId = `tmp-${Date.now()}`;
    const tempMsg: Mensaje = {
      id: tempId,
      rastreo_id: activeRastreo.id,
      user_id: user.id,
      nombre: nombreCompleto || 'Tú',
      texto: texto.trim(),
      foto,
      created_at: new Date().toISOString(),
    };
    setMensajes(prev => [...prev, tempMsg]);
    setChatText('');
    setSendingMsg(true);
    const { data } = await supabase.from('rastreo_mensajes').insert({
      rastreo_id: activeRastreo.id,
      user_id: user.id,
      nombre: nombreCompleto || 'Tú',
      texto: texto.trim(),
      foto,
    }).select().single();
    // Replace temp with real row (realtime may also arrive — dedup by id)
    if (data) {
      setMensajes(prev => prev.map(m => m.id === tempId ? data as Mensaje : m));
    }
    setSendingMsg(false);
  }, [user, activeRastreo, nombreCompleto]);

  const handlePhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await compressImage(file);
      await sendMessage('', b64);
    } catch {}
    e.target.value = '';
  }, [sendMessage]);

  const refreshChat = useCallback(async () => {
    if (!activeRastreo) return;
    const { data } = await supabase
      .from('rastreo_mensajes')
      .select('*')
      .eq('rastreo_id', activeRastreo.id)
      .order('created_at');
    if (data) setMensajes(data as Mensaje[]);
  }, [activeRastreo]);

  // Polling fallback every 12s in case Realtime drops
  useEffect(() => {
    if (view !== 'rastreo' || !activeRastreo) return;
    chatPollRef.current = setInterval(refreshChat, 12000);
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [view, activeRastreo, refreshChat]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const crearRastreo = async () => {
    if (!newNombre.trim()) return;
    setSaving(true);
    try {
      const { data } = await supabase.from('rastreos').insert({
        perrera_id: perreraId,
        nombre: newNombre.trim(),
        fecha: newFecha,
        notas: '',
        estado: 'activo',
      }).select().single();
      if (data) { setNewNombre(''); await openRastreo(data as Rastreo); }
    } catch {}
    setSaving(false);
  };

  const deleteRastreo = async (id: string) => {
    if (!confirm('¿Eliminar este rastreo y todos sus puntos?')) return;
    await rastreosDB.delete(id);
    loadAll();
    if (view !== 'list') exitRastreo();
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors";

  // ── Views ─────────────────────────────────────────────────────────────────

  if (view === 'newrastreo') return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={20} /></button>
        <h2 className="text-amber-300 font-bold text-lg">Nuevo Rastreo</h2>
      </div>
      <div>
        <label className="text-amber-600 text-xs uppercase tracking-wider mb-2 block">Nombre del rastreo *</label>
        <input className={inputCls} placeholder="Ej: Sierra Norte — 22 mayo" value={newNombre} onChange={e => setNewNombre(e.target.value)} />
      </div>
      <div>
        <label className="text-amber-600 text-xs uppercase tracking-wider mb-2 block">Fecha</label>
        <input type="date" className={inputCls} value={newFecha} onChange={e => setNewFecha(e.target.value)} />
      </div>
      <p className="text-amber-700 text-xs">El rastreo quedará activo para que otros miembros de tu perrera puedan unirse en tiempo real.</p>
      <button
        onClick={crearRastreo}
        disabled={saving || !newNombre.trim()}
        className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Check size={18} /> {saving ? 'Creando...' : 'Crear rastreo'}
      </button>
    </div>
  );

  if (view === 'listpuntos' && activeRastreo) {
    const animalCounts = ANIMALES.map(a => ({ ...a, count: puntos.filter(p => p.animal === a.value).length })).filter(a => a.count > 0);
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-amber-700/20 bg-black/50 flex-shrink-0">
          <button onClick={() => setView('rastreo')} className="text-amber-500 hover:text-amber-300"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <p className="text-amber-200 font-semibold text-sm">{activeRastreo.nombre}</p>
            <p className="text-amber-700 text-xs">{puntos.length} punto{puntos.length !== 1 ? 's' : ''}</p>
          </div>
          {animalCounts.map(a => (
            <div key={a.value} className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5 border border-amber-700/20">
              <AnimalIcon animal={a.value} size={14} />
              <span className="text-amber-300 text-xs font-bold">{a.count}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {puntos.length === 0 ? (
            <div className="text-center py-16 text-amber-700"><MapPin size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Sin puntos marcados aún</p></div>
          ) : puntos.map((p, i) => {
            const anim = ANIMALES.find(a => a.value === p.animal)!;
            return (
              <div key={p.id} className="bg-black/30 border border-amber-700/20 rounded-xl flex items-center gap-3 px-3 py-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: anim.markerColor + '33', border: `1.5px solid ${anim.markerColor}66` }}>
                  <AnimalIcon animal={p.animal} size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-200 text-sm font-medium">{anim.label} <span className="text-amber-700 font-normal text-xs">#{i + 1}</span></p>
                  <p className="text-amber-800 text-xs font-mono">{p.latitud.toFixed(5)}, {p.longitud.toFixed(5)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.direccion != null && (
                      <span className="text-blue-400 text-xs font-semibold">
                        &#8594; {getCardinalLabel(p.direccion)} ({p.direccion}°)
                      </span>
                    )}
                    {p.notas && <p className="text-amber-600 text-xs truncate">{p.notas}</p>}
                  </div>
                </div>
                <button onClick={() => rastreoPuntosDB.delete(p.id).then(() => setPuntos(prev => prev.filter(x => x.id !== p.id)))} className="text-red-700 hover:text-red-400 p-1"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === 'rastreo' && activeRastreo) {
    const animalActual = ANIMALES.find(a => a.value === animalSeleccionado)!;
    const onlineCount = participantes.length;
    const isCreator = (activeRastreo as any).user_id === user?.id || !(activeRastreo as any).user_id;
    const normalizedAngle = Math.round(((arrowAngle % 360) + 360) % 360);

    return (
      <div className="fixed inset-0 flex flex-col bg-black" style={{ zIndex: 9999, top: 0 }}>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2"
          style={{ zIndex: 10010, background: 'linear-gradient(to bottom, rgba(10,26,5,0.95) 80%, transparent)' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={exitRastreo}
              className="flex items-center gap-1.5 bg-black/70 backdrop-blur border border-amber-700/40 text-amber-300 rounded-xl px-3 py-2 text-sm font-semibold shadow-lg"
            >
              <ArrowLeft size={15} /> Salir
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur border border-green-700/40 rounded-xl px-2.5 py-1.5">
              <Radio size={12} className="text-green-400 animate-pulse" />
              <div className="flex -space-x-1">
                {participantes.map(p => (
                  <div key={p.user_id} className="w-5 h-5 rounded-full border border-black flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: p.color }}>
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <span className="text-green-300 text-xs font-bold">{onlineCount}</span>
            </div>
            <button
              onClick={() => setView('listpuntos')}
              className="bg-black/70 backdrop-blur border border-amber-700/30 text-amber-400 rounded-xl px-2.5 py-1.5 text-xs flex items-center gap-1.5 shadow-lg"
            >
              <List size={13} /> {puntos.length}
            </button>
            {isCreator && (
              <button
                onClick={finalizarRastreo}
                className="bg-black/70 backdrop-blur border border-red-700/40 text-red-400 rounded-xl px-2.5 py-1.5 text-xs flex items-center gap-1.5 shadow-lg"
              >
                <CheckCircle2 size={13} /> Finalizar
              </button>
            )}
          </div>
        </div>

        {/* Nombre rastreo */}
        <div className="absolute left-3 right-3 flex justify-center pointer-events-none" style={{ zIndex: 10010, top: 56 }}>
          <div className="bg-black/65 backdrop-blur border border-amber-700/25 rounded-xl px-4 py-1.5">
            <p className="text-amber-200 font-semibold text-sm text-center">{activeRastreo.nombre}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="absolute left-3 right-3 flex gap-1" style={{ zIndex: 10010, top: 96 }}>
          <button
            onClick={() => setTab('mapa')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${tab === 'mapa' ? 'bg-amber-700/80 border-amber-500 text-white' : 'bg-black/60 border-amber-700/30 text-amber-500'}`}
          >
            <MapIcon size={12} /> Mapa
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${tab === 'chat' ? 'bg-amber-700/80 border-amber-500 text-white' : 'bg-black/60 border-amber-700/30 text-amber-500'}`}
          >
            <MessageCircle size={12} /> Chat
            {unreadChat > 0 && <span className="bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{unreadChat}</span>}
          </button>
        </div>

        {/* MAPA tab */}
        {tab === 'mapa' && (
          <div className="flex-1 relative" style={{ paddingTop: 130 }}>
            <div style={{ position: 'absolute', inset: 0, top: 130 }}>
              <LiveMap
                puntos={puntos}
                participantes={participantes}
                myUserId={user?.id ?? ''}
                centerOnGps={true}
                onGpsPosition={handleGpsPosition}
                onGpsError={msg => setGpsError(msg)}
                externalGpsPos={gpsActual}
                onCrosshairClick={recentrarGps}
                pendingPunto={pendingDirPunto}
                arrowAngle={arrowAngle}
                onArrowAngleChange={setArrowAngle}
              />
            </div>

            {gpsError && (
              <div className="absolute left-4 right-4 bg-red-900/90 border border-red-600/50 rounded-xl px-4 py-2 flex items-center gap-2" style={{ zIndex: 10010, top: 10 }}>
                <span className="text-red-200 text-xs flex-1">{gpsError}</span>
                <button onClick={() => setGpsError('')}><X size={14} className="text-red-400" /></button>
              </div>
            )}

            {/* ── Panel dirección (compacto, mapa visible) ── */}
            {pendingDirPunto && (
              <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 10005, background: 'linear-gradient(to top, rgba(5,15,5,0.98) 75%, transparent)' }}>
                <div className="px-4 pb-4 pt-10">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-bold text-base">¿Hacia dónde van las huellas?</p>
                      <p className="text-white/50 text-xs mt-0.5">Toca el mapa y arrastra hacia la dirección</p>
                    </div>
                    <div className="bg-blue-900/60 border border-blue-500/40 rounded-xl px-3 py-1.5 text-center min-w-[64px]">
                      <p className="text-blue-200 font-bold text-xl leading-none">{getCardinalLabel(normalizedAngle)}</p>
                      <p className="text-blue-400/70 text-[10px] mt-0.5">{normalizedAngle}°</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saltarDireccion}
                      className="flex-1 py-3 rounded-2xl border border-white/15 text-white/50 font-semibold text-sm"
                    >
                      Saltar
                    </button>
                    <button
                      onClick={confirmarDireccion}
                      className="flex-[2] py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors"
                    >
                      <Check size={17} /> Marcar dirección
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Panel inferior ── */}
            {!pendingDirPunto && !showAnimalPanel && (
              <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 10005, background: 'linear-gradient(to top, rgba(10,26,5,0.97) 70%, transparent)' }}>
                <div className="px-3 pb-3 pt-8 space-y-2">
                  {/* GPS status */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-black/40 border border-blue-800/30 rounded-xl px-3 py-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${gpsActual ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`} />
                      <span className={`text-xs font-mono truncate ${gpsActual ? 'text-blue-300' : 'text-amber-800'}`}>
                        {gpsActual ? `${gpsActual.lat.toFixed(5)}, ${gpsActual.lng.toFixed(5)}` : 'Sin posición GPS'}
                      </span>
                    </div>
                    <button
                      onClick={recentrarGps}
                      disabled={geolocating}
                      className="w-10 h-10 flex-shrink-0 rounded-xl bg-blue-700/80 hover:bg-blue-600 border border-blue-500/40 flex items-center justify-center text-white disabled:opacity-50 transition-colors"
                    >
                      {geolocating
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Crosshair size={18} />}
                    </button>
                  </div>

                  {/* Species + action */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAnimalPanel(true)}
                      className="flex items-center gap-1.5 bg-black/40 border border-amber-700/30 hover:border-amber-600/60 rounded-xl px-3 py-2.5 flex-shrink-0 transition-colors"
                    >
                      <AnimalIcon animal={animalSeleccionado} size={20} />
                      <span className="text-amber-300 text-xs font-medium">{animalActual.label}</span>
                      <span className="text-amber-700 text-xs">▾</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!gpsActual) { recentrarGps(); return; }
                        setShowAnimalPanel(true);
                      }}
                      disabled={geolocating || saving}
                      className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-900/40 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
                    >
                      <MapPin size={18} />
                      {geolocating ? 'Obteniendo GPS...' : saving ? 'Guardando...' : gpsActual ? 'Marcar punto' : 'Obtener GPS'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Panel selección animal ── */}
            {!pendingDirPunto && showAnimalPanel && (
              <div className="absolute bottom-0 left-0 right-0 bg-[#0a1a05] border-t border-amber-700/40 p-4 space-y-3" style={{ zIndex: 10005 }}>
                <div className="flex items-center justify-between">
                  <p className="text-amber-400 text-sm font-semibold">¿Qué animal?</p>
                  <button onClick={() => { setShowAnimalPanel(false); setPuntoNotas(''); }} className="text-amber-700 hover:text-amber-400"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ANIMALES.map(a => (
                    <button key={a.value} onClick={() => setAnimalSeleccionado(a.value)}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${animalSeleccionado === a.value ? 'border-amber-500 bg-amber-900/40 scale-105' : 'border-amber-700/20 bg-black/20'}`}>
                      <AnimalIcon animal={a.value} size={28} />
                      <span className={`text-xs font-medium ${animalSeleccionado === a.value ? 'text-amber-300' : 'text-amber-700'}`}>{a.label}</span>
                    </button>
                  ))}
                </div>
                <input
                  className="w-full bg-black/40 border border-amber-700/30 rounded-xl px-3 py-2.5 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500"
                  placeholder="Notas del punto (opcional)"
                  value={puntoNotas}
                  onChange={e => setPuntoNotas(e.target.value)}
                />
                {/* GPS status in panel */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-black/40 border border-blue-800/30 rounded-xl px-3 py-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${gpsActual ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`} />
                    <span className={`text-xs font-mono truncate ${gpsActual ? 'text-blue-300' : 'text-amber-800'}`}>
                      {gpsActual ? `${gpsActual.lat.toFixed(5)}, ${gpsActual.lng.toFixed(5)}` : 'Sin posición GPS'}
                    </span>
                  </div>
                  <button
                    onClick={recentrarGps}
                    disabled={geolocating}
                    className="w-9 h-9 flex-shrink-0 rounded-xl bg-blue-700/80 hover:bg-blue-600 border border-blue-500/40 flex items-center justify-center text-white disabled:opacity-50"
                  >
                    {geolocating
                      ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Crosshair size={16} />}
                  </button>
                </div>
                <button
                  onClick={guardarPuntoGps}
                  disabled={saving || !gpsActual}
                  className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900/40 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Check size={18} /> {saving ? 'Guardando...' : 'Confirmar punto'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CHAT tab */}
        {tab === 'chat' && (
          <div className="flex flex-col" style={{ position: 'absolute', inset: 0, top: 130, zIndex: 10005 }}>
            <div className="flex items-center gap-2 px-3 py-2 bg-black/70 border-b border-amber-700/20 overflow-x-auto">
              {participantes.map(p => (
                <div key={p.user_id} className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.color }}>{p.nombre.charAt(0).toUpperCase()}</div>
                  <span className="text-xs" style={{ color: p.color }}>{p.nombre.split(' ')[0]}</span>
                </div>
              ))}
              {participantes.length === 0 && <span className="text-amber-800 text-xs">Solo tú</span>}
              <button
                onClick={refreshChat}
                className="ml-auto flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-900/30 border border-amber-700/30 text-amber-500 hover:text-amber-300 text-xs transition-colors"
              >
                <RefreshCw size={11} /> Actualizar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-20" style={{ background: 'rgba(5,15,5,0.95)' }}>
              {mensajes.length === 0 && (
                <div className="text-center py-10 text-amber-800 text-xs">Sin mensajes aún. ¡Di algo!</div>
              )}
              {mensajes.map(m => {
                const isMine = m.user_id === user?.id;
                const partColor = participantes.find(p => p.user_id === m.user_id)?.color ?? '#f59e0b';
                return (
                  <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                      {!isMine && <span className="text-[10px] font-semibold pl-1" style={{ color: partColor }}>{m.nombre.split(' ')[0]}</span>}
                      <div className={`rounded-2xl px-3 py-2 ${isMine ? 'bg-amber-700/80 rounded-tr-sm' : 'bg-black/50 border border-amber-700/20 rounded-tl-sm'}`}>
                        {m.foto && <img src={m.foto} alt="" className="rounded-xl max-w-full mb-1" style={{ maxHeight: 200 }} />}
                        {m.texto && <p className={`text-sm leading-snug ${isMine ? 'text-white' : 'text-amber-100'}`}>{m.texto}</p>}
                      </div>
                      <span className="text-[10px] text-amber-800 px-1">{new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2 px-3 py-3 border-t border-amber-700/20" style={{ background: 'rgba(10,26,5,0.97)' }}>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhoto} />
              <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={handlePhoto} />
              <button onClick={() => fileInputRef.current?.click()} title="Galería" className="w-10 h-10 flex-shrink-0 rounded-full bg-black/40 border border-amber-700/30 flex items-center justify-center text-amber-600 hover:text-amber-400 transition-colors">
                <ImageIcon size={17} />
              </button>
              <button onClick={() => cameraInputRef.current?.click()} title="Cámara" className="w-10 h-10 flex-shrink-0 rounded-full bg-black/40 border border-amber-700/30 flex items-center justify-center text-amber-600 hover:text-amber-400 transition-colors">
                <Camera size={17} />
              </button>
              <input
                className="flex-1 bg-black/40 border border-amber-700/30 rounded-2xl px-4 py-2.5 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500 max-h-24"
                placeholder="Mensaje..."
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatText); } }}
              />
              <button
                onClick={() => sendMessage(chatText)}
                disabled={sendingMsg || !chatText.trim()}
                className="w-10 h-10 flex-shrink-0 rounded-full bg-amber-700 disabled:bg-amber-900/40 flex items-center justify-center text-white"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Lista de rastreos ────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-amber-300 font-bold text-lg">Rastreos</h2>
        <button
          onClick={() => { setNewNombre(''); setNewFecha(new Date().toISOString().split('T')[0]); setView('newrastreo'); }}
          className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {activos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Radio size={13} className="text-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-semibold uppercase tracking-wider">En curso</span>
          </div>
          {activos.map(r => (
            <button
              key={r.id}
              onClick={() => openRastreo(r)}
              className="w-full bg-green-900/20 border border-green-700/30 hover:border-green-600/50 hover:bg-green-900/30 rounded-2xl overflow-hidden transition-all text-left group"
            >
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-800/30 border border-green-700/40 flex items-center justify-center flex-shrink-0">
                  <Radio size={18} className="text-green-400 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-green-200 font-semibold text-sm">{r.nombre}</p>
                  <p className="text-green-700 text-xs mt-0.5">{new Date(r.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} · Toca para unirte</p>
                </div>
                <span className="text-xs bg-green-700/40 text-green-300 px-2 py-1 rounded-lg font-medium">Unirse</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loaded ? (
        <div className="text-center py-10"><div className="w-7 h-7 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : rastreos.length > 0 ? (
        <div className="space-y-2">
          {activos.length > 0 && <p className="text-amber-700 text-xs font-medium uppercase tracking-wider pt-2">Finalizados</p>}
          {rastreos.map(r => (
            <div key={r.id} className="w-full bg-black/30 border border-amber-700/20 rounded-2xl overflow-hidden text-left group flex items-center">
              <button onClick={() => openRastreo(r)} className="flex-1 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-900/20 border border-green-700/30 flex items-center justify-center flex-shrink-0">
                  <Footprints size={18} className="text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-200 font-semibold text-sm">{r.nombre}</p>
                  <p className="text-amber-700 text-xs mt-0.5">{new Date(r.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </button>
              <button onClick={() => deleteRastreo(r.id)} className="px-3 py-3 text-red-800 hover:text-red-500 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : activos.length === 0 ? (
        <div className="text-center py-16 text-amber-700">
          <Footprints size={52} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium">Sin rastreos registrados</p>
          <p className="text-xs mt-1 opacity-60">Crea un nuevo rastreo para empezar</p>
        </div>
      ) : null}
    </div>
  );
}
