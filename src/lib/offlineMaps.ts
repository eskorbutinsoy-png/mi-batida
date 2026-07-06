import L from 'leaflet';

const DB_NAME = 'mi-batida-offline-maps';
const DB_VERSION = 1;
const TILE_STORE = 'tiles';

type TileRecord = {
  key: string;
  provider: string;
  z: number;
  x: number;
  y: number;
  blob: Blob;
  size: number;
  savedAt: number;
};

export type OfflineDownloadOptions = {
  provider: string;
  urlTemplate: string;
  bounds: { north: number; south: number; east: number; west: number };
  minZoom: number;
  maxZoom: number;
  maxTiles?: number;
  concurrency?: number;
  onProgress?: (progress: { downloaded: number; total: number; failed: number }) => void;
};

export type OfflineMapLayerKind = 'streets' | 'satellite' | 'hybrid';

export type SavedOfflineMap = {
  id: string;
  name: string;
  layerKind: OfflineMapLayerKind;
  bounds: { north: number; south: number; east: number; west: number };
  minZoom: number;
  maxZoom: number;
  downloadedTiles: number;
  failedTiles: number;
  totalTiles: number;
  createdAt: string;
};

export type SharedOfflineMapPayload = {
  name: string;
  layerKind: OfflineMapLayerKind;
  bounds: { north: number; south: number; east: number; west: number };
  minZoom: number;
  maxZoom: number;
  sharedBy?: string;
  sharedAt?: string;
};

const SHARED_MAP_PREFIX = 'OFFLINE_MAP_JSON:';

const TILE_SOURCES_BY_LAYER: Record<OfflineMapLayerKind, Array<{ providerId: string; urlTemplate: string }>> = {
  streets: [
    { providerId: 'streets-osm', urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  ],
  satellite: [
    { providerId: 'satellite-esri', urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  ],
  hybrid: [
    { providerId: 'satellite-esri', urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
    { providerId: 'hybrid-labels-osm', urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  ],
};

const OFFLINE_MAPS_META_KEY = 'mi-batida-offline-map-definitions';

function readSavedMaps(): SavedOfflineMap[] {
  try {
    const raw = localStorage.getItem(OFFLINE_MAPS_META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedOfflineMap[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeSavedMaps(maps: SavedOfflineMap[]): void {
  try {
    localStorage.setItem(OFFLINE_MAPS_META_KEY, JSON.stringify(maps));
  } catch {
    /* ignore */
  }
}

export function getSavedOfflineMaps(): SavedOfflineMap[] {
  return readSavedMaps().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function saveOfflineMap(input: Omit<SavedOfflineMap, 'id' | 'createdAt'>): SavedOfflineMap {
  const next: SavedOfflineMap = {
    ...input,
    id: `offline-map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  const all = readSavedMaps();
  all.push(next);
  writeSavedMaps(all);
  return next;
}

export function deleteSavedOfflineMap(id: string): void {
  const all = readSavedMaps();
  const filtered = all.filter((m) => m.id !== id);
  writeSavedMaps(filtered);
}

function getProvidersForLayer(layerKind: OfflineMapLayerKind): string[] {
  const targets = TILE_SOURCES_BY_LAYER[layerKind] || TILE_SOURCES_BY_LAYER.streets;
  return targets.map((target) => target.providerId);
}

function getTileKeysForMap(map: SavedOfflineMap): Set<string> {
  const providers = getProvidersForLayer(map.layerKind);
  const keys = new Set<string>();

  for (let z = map.minZoom; z <= map.maxZoom; z += 1) {
    const xMin = lngToTileX(map.bounds.west, z);
    const xMax = lngToTileX(map.bounds.east, z);
    const yMin = latToTileY(map.bounds.north, z);
    const yMax = latToTileY(map.bounds.south, z);

    const xStart = Math.min(xMin, xMax);
    const xEnd = Math.max(xMin, xMax);
    const yStart = Math.min(yMin, yMax);
    const yEnd = Math.max(yMin, yMax);

    for (let x = xStart; x <= xEnd; x += 1) {
      for (let y = yStart; y <= yEnd; y += 1) {
        providers.forEach((provider) => keys.add(tileKey(provider, z, x, y)));
      }
    }
  }

  return keys;
}

export async function deleteSavedOfflineMapWithTiles(id: string): Promise<{ removedMap: boolean; removedTiles: number }> {
  const all = readSavedMaps();
  const target = all.find((map) => map.id === id);
  if (!target) {
    return { removedMap: false, removedTiles: 0 };
  }

  const targetKeys = getTileKeysForMap(target);
  const keepKeys = new Set<string>();

  all
    .filter((map) => map.id !== id)
    .forEach((map) => {
      getTileKeysForMap(map).forEach((key) => keepKeys.add(key));
    });

  const keysToDelete = Array.from(targetKeys).filter((key) => !keepKeys.has(key));
  const db = await openDb();
  const removedTiles = await idbDeleteMany(db, TILE_STORE, keysToDelete);

  writeSavedMaps(all.filter((map) => map.id !== id));
  return { removedMap: true, removedTiles };
}

export function createSharedOfflineMapMessage(payload: SharedOfflineMapPayload): string {
  const encoded = encodeURIComponent(JSON.stringify(payload));
  return [
    `🗺️ MAPA OFFLINE COMPARTIDO · ${payload.name}`,
    'Pulsa el boton de descargar en este mensaje para guardarlo offline.',
    `${SHARED_MAP_PREFIX}${encoded}`,
  ].join('\n');
}

export function parseSharedOfflineMapMessage(message: string): SharedOfflineMapPayload | null {
  if (!message || !message.includes(SHARED_MAP_PREFIX)) return null;
  const idx = message.indexOf(SHARED_MAP_PREFIX);
  if (idx < 0) return null;
  const encoded = message.slice(idx + SHARED_MAP_PREFIX.length).trim();
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as SharedOfflineMapPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.name || !parsed.layerKind || !parsed.bounds) return null;
    if (typeof parsed.minZoom !== 'number' || typeof parsed.maxZoom !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function downloadSharedOfflineMap(
  payload: SharedOfflineMapPayload,
  onProgress?: (progress: { downloaded: number; total: number; failed: number }) => void,
): Promise<{ downloaded: number; total: number; failed: number }> {
  const targets = TILE_SOURCES_BY_LAYER[payload.layerKind] || TILE_SOURCES_BY_LAYER.streets;
  let downloadedAll = 0;
  let totalAll = 0;
  let failedAll = 0;

  for (const target of targets) {
    const result = await downloadOfflineTiles({
      provider: target.providerId,
      urlTemplate: target.urlTemplate,
      bounds: payload.bounds,
      minZoom: payload.minZoom,
      maxZoom: payload.maxZoom,
      onProgress: (progress) => {
        const nextTotal = totalAll + progress.total;
        const nextDownloaded = downloadedAll + progress.downloaded;
        const nextFailed = failedAll + progress.failed;
        if (onProgress) onProgress({ downloaded: nextDownloaded, total: nextTotal, failed: nextFailed });
      },
    });

    downloadedAll += result.downloaded;
    totalAll += result.total;
    failedAll += result.failed;
    if (onProgress) onProgress({ downloaded: downloadedAll, total: totalAll, failed: failedAll });
  }

  return { downloaded: downloadedAll, total: totalAll, failed: failedAll };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TILE_STORE)) {
        const store = db.createObjectStore(TILE_STORE, { keyPath: 'key' });
        store.createIndex('provider', 'provider', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB'));
  });
}

function idbGet<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error || new Error('Error de lectura en IndexedDB'));
  });
}

function idbPut<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(value as unknown as IDBValidKey);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Error de escritura en IndexedDB'));
    tx.onabort = () => reject(tx.error || new Error('Transaccion abortada en IndexedDB'));
  });
}

function idbDelete(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(key);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Error al borrar en IndexedDB'));
    tx.onabort = () => reject(tx.error || new Error('Transaccion abortada en IndexedDB'));
  });
}

function idbDeleteMany(db: IDBDatabase, storeName: string, keys: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    if (keys.length === 0) {
      resolve(0);
      return;
    }

    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    keys.forEach((key) => store.delete(key));

    tx.oncomplete = () => resolve(keys.length);
    tx.onerror = () => reject(tx.error || new Error('Error al borrar varias teselas en IndexedDB'));
    tx.onabort = () => reject(tx.error || new Error('Transaccion abortada al borrar teselas'));
  });
}

function idbGetAllByProvider(db: IDBDatabase, provider: string): Promise<TileRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TILE_STORE, 'readonly');
    const store = tx.objectStore(TILE_STORE);
    const index = store.index('provider');
    const req = index.getAll(provider);

    req.onsuccess = () => resolve((req.result as TileRecord[]) || []);
    req.onerror = () => reject(req.error || new Error('Error al leer tiles por proveedor'));
  });
}

export function tileKey(provider: string, z: number, x: number, y: number): string {
  return `${provider}:${z}:${x}:${y}`;
}

export function makeTileUrl(urlTemplate: string, z: number, x: number, y: number, subdomains: string[] = ['a', 'b', 'c']): string {
  const s = subdomains[(x + y) % subdomains.length] || 'a';
  return urlTemplate
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{s}', s);
}

export async function getCachedTileBlob(provider: string, z: number, x: number, y: number): Promise<Blob | null> {
  const db = await openDb();
  const rec = await idbGet<TileRecord>(db, TILE_STORE, tileKey(provider, z, x, y));
  return rec?.blob || null;
}

async function putCachedTile(provider: string, z: number, x: number, y: number, blob: Blob): Promise<void> {
  const db = await openDb();
  const rec: TileRecord = {
    key: tileKey(provider, z, x, y),
    provider,
    z,
    x,
    y,
    blob,
    size: blob.size,
    savedAt: Date.now(),
  };
  await idbPut(db, TILE_STORE, rec);
}

export async function clearOfflineProvider(provider: string): Promise<number> {
  const db = await openDb();
  const rows = await idbGetAllByProvider(db, provider);
  await Promise.all(rows.map((row) => idbDelete(db, TILE_STORE, row.key)));
  return rows.length;
}

export async function getOfflineProviderStats(provider: string): Promise<{ tiles: number; bytes: number }> {
  const db = await openDb();
  const rows = await idbGetAllByProvider(db, provider);
  const bytes = rows.reduce((acc, row) => acc + row.size, 0);
  return { tiles: rows.length, bytes };
}

function lngToTileX(lng: number, zoom: number): number {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  return clamp(x, 0, n - 1);
}

function latToTileY(lat: number, zoom: number): number {
  const latClamped = clamp(lat, -85.05112878, 85.05112878);
  const latRad = (latClamped * Math.PI) / 180;
  const n = 2 ** zoom;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return clamp(y, 0, n - 1);
}

export function estimateTilesForBounds(bounds: { north: number; south: number; east: number; west: number }, minZoom: number, maxZoom: number): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const xMin = lngToTileX(bounds.west, z);
    const xMax = lngToTileX(bounds.east, z);
    const yMin = latToTileY(bounds.north, z);
    const yMax = latToTileY(bounds.south, z);
    total += (Math.abs(xMax - xMin) + 1) * (Math.abs(yMax - yMin) + 1);
  }
  return total;
}

export async function downloadOfflineTiles(options: OfflineDownloadOptions): Promise<{ downloaded: number; failed: number; total: number }> {
  const {
    provider,
    urlTemplate,
    bounds,
    minZoom,
    maxZoom,
    maxTiles = 3500,
    concurrency = 8,
    onProgress,
  } = options;

  const jobs: Array<{ z: number; x: number; y: number; url: string }> = [];

  for (let z = minZoom; z <= maxZoom; z += 1) {
    const xMin = lngToTileX(bounds.west, z);
    const xMax = lngToTileX(bounds.east, z);
    const yMin = latToTileY(bounds.north, z);
    const yMax = latToTileY(bounds.south, z);

    const xStart = Math.min(xMin, xMax);
    const xEnd = Math.max(xMin, xMax);
    const yStart = Math.min(yMin, yMax);
    const yEnd = Math.max(yMin, yMax);

    for (let x = xStart; x <= xEnd; x += 1) {
      for (let y = yStart; y <= yEnd; y += 1) {
        jobs.push({ z, x, y, url: makeTileUrl(urlTemplate, z, x, y) });
      }
    }
  }

  if (jobs.length > maxTiles) {
    throw new Error(`La zona seleccionada genera ${jobs.length} teselas. Reduce la zona o el zoom (max ${maxTiles}).`);
  }

  let cursor = 0;
  let downloaded = 0;
  let failed = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= jobs.length) break;

      const job = jobs[idx];
      try {
        const existing = await getCachedTileBlob(provider, job.z, job.x, job.y);
        if (!existing) {
          const response = await fetch(job.url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          await putCachedTile(provider, job.z, job.x, job.y, blob);
        }
        downloaded += 1;
      } catch {
        failed += 1;
      }

      if (onProgress) {
        onProgress({ downloaded, failed, total: jobs.length });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker());
  await Promise.all(workers);

  return { downloaded, failed, total: jobs.length };
}

export type OfflineTileLayerOptions = L.TileLayerOptions & {
  providerId: string;
  networkFallback?: boolean;
  offlineOpacity?: number;
};

export class OfflineTileLayer extends L.TileLayer {
  declare options: OfflineTileLayerOptions;

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');

    L.DomEvent.on(tile, 'load', () => done(undefined, tile));
    L.DomEvent.on(tile, 'error', () => done(new Error('Tile load error'), tile));

    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    const z = coords.z;
    const x = coords.x;
    const y = coords.y;

    void (async () => {
      const cached = await getCachedTileBlob(this.options.providerId, z, x, y);
      if (cached) {
        const objectUrl = URL.createObjectURL(cached);
        tile.onload = () => {
          URL.revokeObjectURL(objectUrl);
          done(undefined, tile);
        };
        tile.src = objectUrl;
        if (typeof this.options.offlineOpacity === 'number') {
          tile.style.opacity = String(this.options.offlineOpacity);
        }
        return;
      }

      if (this.options.networkFallback === false) {
        const emptySvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"></svg>');
        tile.src = `data:image/svg+xml,${emptySvg}`;
        return;
      }

      tile.src = this.getTileUrl(coords);
    })();

    return tile;
  }
}

export function createOfflineTileLayer(urlTemplate: string, options: OfflineTileLayerOptions): OfflineTileLayer {
  return new OfflineTileLayer(urlTemplate, options);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}
