import type {
  Perro, PerroHistorial, Caceria, CaceriaAnimal,
  Salud, GpsPunto, Telefono, Rastreo, RastreoPunto,
  CollarGps, Gasto, Cronometro
} from './types';

// ----- generic helpers -----

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function loadObj<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveObj<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ----- PERROS -----

export const perrosDB = {
  list(): Perro[] {
    return load<Perro>('perros').sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      return a.created_at.localeCompare(b.created_at);
    });
  },
  insert(data: Omit<Perro, 'id' | 'created_at' | 'updated_at'>): Perro {
    const perros = load<Perro>('perros');
    const record: Perro = { ...data, id: uid(), created_at: now(), updated_at: now() };
    perros.push(record);
    save('perros', perros);
    return record;
  },
  update(id: string, data: Partial<Omit<Perro, 'id' | 'created_at'>>): void {
    const perros = load<Perro>('perros').map(p =>
      p.id === id ? { ...p, ...data, updated_at: now() } : p
    );
    save('perros', perros);
  },
  delete(id: string): void {
    save('perros', load<Perro>('perros').filter(p => p.id !== id));
  },
};

// ----- PERROS HISTORIAL -----

export const perrosHistorialDB = {
  listByPerro(perro_id: string): PerroHistorial[] {
    return load<PerroHistorial>('perros_historial')
      .filter(h => h.perro_id === perro_id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  },
  insert(data: Omit<PerroHistorial, 'id' | 'created_at'>): PerroHistorial {
    const list = load<PerroHistorial>('perros_historial');
    const record: PerroHistorial = { ...data, id: uid(), created_at: now() };
    list.push(record);
    save('perros_historial', list);
    return record;
  },
  update(id: string, data: Partial<Omit<PerroHistorial, 'id' | 'created_at'>>): void {
    save('perros_historial', load<PerroHistorial>('perros_historial').map(h =>
      h.id === id ? { ...h, ...data } : h
    ));
  },
  delete(id: string): void {
    save('perros_historial', load<PerroHistorial>('perros_historial').filter(h => h.id !== id));
  },
  deleteByPerro(perro_id: string): void {
    save('perros_historial', load<PerroHistorial>('perros_historial').filter(h => h.perro_id !== perro_id));
  },
};

// ----- CACERIAS -----

export const caceriasDB = {
  list(): Caceria[] {
    return load<Caceria>('cacerias').sort((a, b) => b.fecha.localeCompare(a.fecha));
  },
  insert(data: Omit<Caceria, 'id' | 'created_at'>): Caceria {
    const list = load<Caceria>('cacerias');
    const record: Caceria = { ...data, id: uid(), created_at: now() };
    list.push(record);
    save('cacerias', list);
    return record;
  },
  update(id: string, data: Partial<Omit<Caceria, 'id' | 'created_at'>>): void {
    save('cacerias', load<Caceria>('cacerias').map(c =>
      c.id === id ? { ...c, ...data } : c
    ));
  },
  delete(id: string): void {
    save('cacerias', load<Caceria>('cacerias').filter(c => c.id !== id));
  },
};

// ----- CACERIA ANIMALES -----

export const caceriaAnimalesDB = {
  listByCaceria(caceria_id: string): CaceriaAnimal[] {
    return load<CaceriaAnimal>('caceria_animales').filter(a => a.caceria_id === caceria_id);
  },
  insertMany(items: Omit<CaceriaAnimal, 'id'>[]): void {
    const list = load<CaceriaAnimal>('caceria_animales');
    items.forEach(item => list.push({ ...item, id: uid() }));
    save('caceria_animales', list);
  },
  deleteByCaceria(caceria_id: string): void {
    save('caceria_animales', load<CaceriaAnimal>('caceria_animales').filter(a => a.caceria_id !== caceria_id));
  },
};

// ----- CACERIA PERROS -----

interface CaceriaPerroRaw {
  id: string;
  caceria_id: string;
  perro_id: string;
  levantados: number;
  perseguidos: number;
  perdidos: number;
  muertes: number;
  duracion_minutos: number;
}

interface CaceriaPerroEspecieRaw {
  id: string;
  caceria_perro_id: string;
  campo: string;
  especie: string;
  cantidad: number;
}

export const caceriaPerrosDB = {
  listByCaceria(caceria_id: string): CaceriaPerroRaw[] {
    return load<CaceriaPerroRaw>('caceria_perros').filter(p => p.caceria_id === caceria_id);
  },
  listAll(): CaceriaPerroRaw[] {
    return load<CaceriaPerroRaw>('caceria_perros');
  },
  insertMany(items: Omit<CaceriaPerroRaw, 'id'>[]): CaceriaPerroRaw[] {
    const list = load<CaceriaPerroRaw>('caceria_perros');
    const inserted: CaceriaPerroRaw[] = items.map(item => ({ ...item, id: uid() }));
    inserted.forEach(r => list.push(r));
    save('caceria_perros', list);
    return inserted;
  },
  deleteByCaceria(caceria_id: string): void {
    const ids = load<CaceriaPerroRaw>('caceria_perros').filter(p => p.caceria_id === caceria_id).map(p => p.id);
    save('caceria_perros', load<CaceriaPerroRaw>('caceria_perros').filter(p => p.caceria_id !== caceria_id));
    caceriaPerroEspeciesDB.deleteByPerroIds(ids);
  },
};

export const caceriaPerroEspeciesDB = {
  listByPerroIds(ids: string[]): CaceriaPerroEspecieRaw[] {
    return load<CaceriaPerroEspecieRaw>('caceria_perro_especies').filter(e => ids.includes(e.caceria_perro_id));
  },
  insertMany(items: Omit<CaceriaPerroEspecieRaw, 'id'>[]): void {
    const list = load<CaceriaPerroEspecieRaw>('caceria_perro_especies');
    items.forEach(item => list.push({ ...item, id: uid() }));
    save('caceria_perro_especies', list);
  },
  deleteByPerroIds(ids: string[]): void {
    save('caceria_perro_especies', load<CaceriaPerroEspecieRaw>('caceria_perro_especies').filter(e => !ids.includes(e.caceria_perro_id)));
  },
};

// ----- SALUD -----

export const saludDB = {
  list(): Salud[] {
    return load<Salud>('salud');
  },
  listWithPerro(): (Omit<Salud, 'perro'> & { perro?: { nombre: string } })[] {
    const perros = load<Perro>('perros');
    return load<Salud>('salud').map(({ perro, ...s }) => ({
      ...s,
      perro: perros.find(p => p.id === s.perro_id)
        ? { nombre: perros.find(p => p.id === s.perro_id)!.nombre }
        : undefined,
    }));
  },
  insert(data: Omit<Salud, 'id' | 'created_at'>): Salud {
    const list = load<Salud>('salud');
    const record: Salud = { ...data, id: uid(), created_at: now() };
    list.push(record);
    save('salud', list);
    return record;
  },
  update(id: string, data: Partial<Omit<Salud, 'id' | 'created_at'>>): void {
    save('salud', load<Salud>('salud').map(s => s.id === id ? { ...s, ...data } : s));
  },
  delete(id: string): void {
    save('salud', load<Salud>('salud').filter(s => s.id !== id));
  },
};

// ----- GPS PUNTOS -----

export const gpsPuntosDB = {
  list(): GpsPunto[] {
    return load<GpsPunto>('gps_puntos').sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  insert(data: Omit<GpsPunto, 'id' | 'created_at'>): GpsPunto {
    const list = load<GpsPunto>('gps_puntos');
    const record: GpsPunto = { ...data, id: uid(), created_at: now() };
    list.push(record);
    save('gps_puntos', list);
    return record;
  },
  delete(id: string): void {
    save('gps_puntos', load<GpsPunto>('gps_puntos').filter(p => p.id !== id));
  },
};

// ----- TELEFONOS -----

export const telefonosDB = {
  list(): Telefono[] {
    return load<Telefono>('telefonos').sort((a, b) => a.nombre.localeCompare(b.nombre));
  },
  insert(data: Omit<Telefono, 'id' | 'created_at'>): Telefono {
    const list = load<Telefono>('telefonos');
    const record: Telefono = { ...data, id: uid(), created_at: now() };
    list.push(record);
    save('telefonos', list);
    return record;
  },
  update(id: string, data: Partial<Omit<Telefono, 'id' | 'created_at'>>): void {
    save('telefonos', load<Telefono>('telefonos').map(t => t.id === id ? { ...t, ...data } : t));
  },
  delete(id: string): void {
    save('telefonos', load<Telefono>('telefonos').filter(t => t.id !== id));
  },
};

// ----- RASTREOS -----

export const rastreosDB = {
  list(): Rastreo[] {
    return load<Rastreo>('rastreos').sort((a, b) => b.fecha.localeCompare(a.fecha));
  },
  insert(data: Omit<Rastreo, 'id' | 'created_at'>): Rastreo {
    const list = load<Rastreo>('rastreos');
    const record: Rastreo = { ...data, id: uid(), created_at: now() };
    list.push(record);
    save('rastreos', list);
    return record;
  },
  delete(id: string): void {
    save('rastreos', load<Rastreo>('rastreos').filter(r => r.id !== id));
    rastreoPuntosDB.deleteByRastreo(id);
  },
};

export const rastreoPuntosDB = {
  listByRastreo(rastreo_id: string): RastreoPunto[] {
    return load<RastreoPunto>('rastreo_puntos')
      .filter(p => p.rastreo_id === rastreo_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  insert(data: Omit<RastreoPunto, 'id' | 'created_at'>): RastreoPunto {
    const list = load<RastreoPunto>('rastreo_puntos');
    const record: RastreoPunto = { ...data, id: uid(), created_at: now() };
    list.push(record);
    save('rastreo_puntos', list);
    return record;
  },
  delete(id: string): void {
    save('rastreo_puntos', load<RastreoPunto>('rastreo_puntos').filter(p => p.id !== id));
  },
  deleteByRastreo(rastreo_id: string): void {
    save('rastreo_puntos', load<RastreoPunto>('rastreo_puntos').filter(p => p.rastreo_id !== rastreo_id));
  },
};

// ----- COLLARES GPS -----

export const collaresGpsDB = {
  list(): CollarGps[] {
    return load<CollarGps>('collares_gps').sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  insert(data: Omit<CollarGps, 'id' | 'created_at' | 'updated_at'>): CollarGps {
    const list = load<CollarGps>('collares_gps');
    const record: CollarGps = { ...data, id: uid(), created_at: now(), updated_at: now() };
    list.push(record);
    save('collares_gps', list);
    return record;
  },
  update(id: string, data: Partial<Omit<CollarGps, 'id' | 'created_at'>>): void {
    save('collares_gps', load<CollarGps>('collares_gps').map(c =>
      c.id === id ? { ...c, ...data, updated_at: now() } : c
    ));
  },
  delete(id: string): void {
    save('collares_gps', load<CollarGps>('collares_gps').filter(c => c.id !== id));
  },
};

// ----- GASTOS -----

export const gastosDB = {
  list(): Gasto[] {
    return load<Gasto>('gastos').sort((a, b) => {
      const d = b.fecha.localeCompare(a.fecha);
      return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
    });
  },
  insert(data: Omit<Gasto, 'id' | 'created_at'>): Gasto {
    const list = load<Gasto>('gastos');
    const record: Gasto = { ...data, id: uid(), created_at: now(), pagado_por: data.pagado_por || '' };
    list.push(record);
    save('gastos', list);
    return record;
  },
  update(id: string, data: Partial<Omit<Gasto, 'id' | 'created_at'>>): void {
    save('gastos', load<Gasto>('gastos').map(g => g.id === id ? { ...g, ...data } : g));
  },
  delete(id: string): void {
    save('gastos', load<Gasto>('gastos').filter(g => g.id !== id));
  },
};

// ----- CRONOMETROS -----

export const cronometrosDB = {
  listWithPerro(): (Omit<Cronometro, 'perro'> & { perro?: { nombre: string; foto: string } })[] {
    const perros = load<Perro>('perros');
    return load<Cronometro>('cronometros')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ perro, ...c }) => ({
        ...c,
        perro: perros.find(p => p.id === c.perro_id)
          ? { nombre: perros.find(p => p.id === c.perro_id)!.nombre, foto: perros.find(p => p.id === c.perro_id)!.foto }
          : undefined,
      }));
  },
  insert(data: Omit<Cronometro, 'id' | 'created_at'>): Cronometro {
    const list = load<Cronometro>('cronometros');
    const record: Cronometro = { ...data, id: uid(), created_at: now() };
    list.push(record);
    save('cronometros', list);
    return record;
  },
  delete(id: string): void {
    save('cronometros', load<Cronometro>('cronometros').filter(c => c.id !== id));
  },
};

// ----- CONFIGURACION -----

type ConfigData = Record<string, string>;

export const configuracionDB = {
  get(clave: string): string | null {
    const cfg = loadObj<ConfigData>('configuracion', {});
    return cfg[clave] ?? null;
  },
  set(clave: string, valor: string): void {
    const cfg = loadObj<ConfigData>('configuracion', {});
    cfg[clave] = valor;
    saveObj('configuracion', cfg);
  },
  getAll(): ConfigData {
    return loadObj<ConfigData>('configuracion', {});
  },
};

// ----- NOTIFICACIONES VISTAS -----

export const notificacionesDB = {
  isVista(salud_id: string, fecha_proximo: string): boolean {
    const key = `${salud_id}_${fecha_proximo}`;
    const vistas = loadObj<Record<string, boolean>>('notificaciones_vistas', {});
    return vistas[key] === true;
  },
  markVista(salud_id: string, fecha_proximo: string): void {
    const key = `${salud_id}_${fecha_proximo}`;
    const vistas = loadObj<Record<string, boolean>>('notificaciones_vistas', {});
    vistas[key] = true;
    saveObj('notificaciones_vistas', vistas);
  },
};

// ----- BACKUP / RESTORE -----

export function exportBackup(): string {
  const data = {
    version: 1,
    exportedAt: now(),
    perros: load('perros'),
    perros_historial: load('perros_historial'),
    cacerias: load('cacerias'),
    caceria_animales: load('caceria_animales'),
    caceria_perros: load('caceria_perros'),
    caceria_perro_especies: load('caceria_perro_especies'),
    salud: load('salud'),
    gps_puntos: load('gps_puntos'),
    rastreos: load('rastreos'),
    rastreo_puntos: load('rastreo_puntos'),
    telefonos: load('telefonos'),
    cronometros: load('cronometros'),
    collares_gps: load('collares_gps'),
    gastos: load('gastos'),
    configuracion: loadObj('configuracion', {}),
  };
  return JSON.stringify(data, null, 2);
}

export function importBackup(json: string): void {
  const raw = JSON.parse(json);

  // Formato antiguo: { version: "4.0", localStorage: { perros: "[...]", ... } }
  if (raw.localStorage && typeof raw.localStorage === 'object') {
    const ls = raw.localStorage as Record<string, string>;
    Object.entries(ls).forEach(([key, value]) => {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          save(key, parsed);
        } else if (typeof parsed === 'object' && parsed !== null) {
          saveObj(key, parsed);
        }
      } catch {
        // valor ya era string plano, guardarlo tal cual
        localStorage.setItem(key, value);
      }
    });
    return;
  }

  // Formato nuevo: { version: 1, perros: [...], ... }
  const data = raw;
  const keys = [
    'perros', 'perros_historial', 'cacerias', 'caceria_animales',
    'caceria_perros', 'caceria_perro_especies', 'salud', 'gps_puntos',
    'rastreos', 'rastreo_puntos', 'telefonos', 'cronometros',
    'collares_gps', 'gastos',
  ] as const;
  keys.forEach(k => {
    if (Array.isArray(data[k])) save(k, data[k]);
  });
  if (data.configuracion && typeof data.configuracion === 'object') {
    saveObj('configuracion', data.configuracion);
  }
}
