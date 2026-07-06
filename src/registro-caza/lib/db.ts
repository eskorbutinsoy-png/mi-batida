import { supabase } from './supabase';
import type {
  Perro, PerroHistorial, Caceria, CaceriaAnimal, CaceriaPerro,
  Salud, GpsPunto, Telefono, Rastreo, RastreoPunto,
  CollarGps, Gasto, Cronometro
} from './types';

// ---- PERROS ----

export const perrosDB = {
  async list(perreraId: string): Promise<Perro[]> {
    const { data, error } = await supabase
      .from('perros')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, data: Omit<Perro, 'id' | 'created_at' | 'updated_at'>): Promise<Perro> {
    const { data: row, error } = await supabase
      .from('perros')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async update(id: string, data: Partial<Omit<Perro, 'id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase.from('perros').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('perros').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- PERRO HISTORIAL ----

export const perrosHistorialDB = {
  async listByPerro(perro_id: string): Promise<PerroHistorial[]> {
    const { data, error } = await supabase
      .from('perro_historial')
      .select('*')
      .eq('perro_id', perro_id)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, data: Omit<PerroHistorial, 'id' | 'created_at'>): Promise<PerroHistorial> {
    const { data: row, error } = await supabase
      .from('perro_historial')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async update(id: string, data: Partial<Omit<PerroHistorial, 'id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase.from('perro_historial').update(data).eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('perro_historial').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- CACERIAS ----

export const caceriasDB = {
  async list(perreraId: string): Promise<Caceria[]> {
    const { data, error } = await supabase
      .from('cacerias')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, data: Omit<Caceria, 'id' | 'created_at'>): Promise<Caceria> {
    const { data: row, error } = await supabase
      .from('cacerias')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async update(id: string, data: Partial<Omit<Caceria, 'id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase.from('cacerias').update(data).eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('cacerias').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- CACERIA ANIMALES ----

export const caceriaAnimalesDB = {
  async listByCaceria(caceria_id: string): Promise<CaceriaAnimal[]> {
    const { data, error } = await supabase
      .from('caceria_animales')
      .select('*')
      .eq('caceria_id', caceria_id);
    if (error) throw error;
    return data ?? [];
  },
  async insertMany(perreraId: string, items: Omit<CaceriaAnimal, 'id'>[]): Promise<void> {
    if (items.length === 0) return;
    const { error } = await supabase
      .from('caceria_animales')
      .insert(items.map(i => ({ ...i, perrera_id: perreraId })));
    if (error) throw error;
  },
  async deleteByCaceria(caceria_id: string): Promise<void> {
    const { error } = await supabase.from('caceria_animales').delete().eq('caceria_id', caceria_id);
    if (error) throw error;
  },
};

// ---- CACERIA PERROS ----

export const caceriaPerrosDB = {
  async listByCaceria(caceria_id: string): Promise<CaceriaPerro[]> {
    const { data, error } = await supabase
      .from('caceria_perros')
      .select('*')
      .eq('caceria_id', caceria_id);
    if (error) throw error;
    return data ?? [];
  },
  async listAll(perreraId: string): Promise<CaceriaPerro[]> {
    const { data, error } = await supabase
      .from('caceria_perros')
      .select('*')
      .eq('perrera_id', perreraId);
    if (error) throw error;
    return data ?? [];
  },
  async insertMany(perreraId: string, items: Omit<CaceriaPerro, 'id'>[]): Promise<CaceriaPerro[]> {
    if (items.length === 0) return [];
    const { data, error } = await supabase
      .from('caceria_perros')
      .insert(items.map(i => ({ ...i, perrera_id: perreraId })))
      .select();
    if (error) throw error;
    return data ?? [];
  },
  async deleteByCaceria(caceria_id: string): Promise<void> {
    const { error } = await supabase.from('caceria_perros').delete().eq('caceria_id', caceria_id);
    if (error) throw error;
  },
};

// ---- CACERIA PERRO ESPECIES ----

interface CaceriaPerroEspecieRaw {
  id: string;
  caceria_perro_id: string;
  campo: string;
  especie: string;
  cantidad: number;
  perrera_id?: string;
}

export const caceriaPerroEspeciesDB = {
  async listByPerroIds(ids: string[]): Promise<CaceriaPerroEspecieRaw[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('caceria_perro_especies')
      .select('*')
      .in('caceria_perro_id', ids);
    if (error) throw error;
    return data ?? [];
  },
  async insertMany(perreraId: string, items: Omit<CaceriaPerroEspecieRaw, 'id'>[]): Promise<void> {
    if (items.length === 0) return;
    const { error } = await supabase
      .from('caceria_perro_especies')
      .insert(items.map(i => ({ ...i, perrera_id: perreraId })));
    if (error) throw error;
  },
  async deleteByPerroIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('caceria_perro_especies')
      .delete()
      .in('caceria_perro_id', ids);
    if (error) throw error;
  },
};

// ---- SALUD ----

export const saludDB = {
  async list(perreraId: string): Promise<Salud[]> {
    const { data, error } = await supabase
      .from('salud')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listWithPerro(perreraId: string): Promise<(Salud & { perro?: { nombre: string } })[]> {
    const { data, error } = await supabase
      .from('salud')
      .select('*, perro:perros(nombre)')
      .eq('perrera_id', perreraId);
    if (error) throw error;
    return (data ?? []) as (Salud & { perro?: { nombre: string } })[];
  },
  async insert(perreraId: string, data: Omit<Salud, 'id' | 'created_at'>): Promise<Salud> {
    const { data: row, error } = await supabase
      .from('salud')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async update(id: string, data: Partial<Omit<Salud, 'id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase.from('salud').update(data).eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('salud').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- GPS PUNTOS ----

export const gpsPuntosDB = {
  async list(perreraId: string): Promise<GpsPunto[]> {
    const { data, error } = await supabase
      .from('gps_puntos')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, data: Omit<GpsPunto, 'id' | 'created_at'>): Promise<GpsPunto> {
    const { data: row, error } = await supabase
      .from('gps_puntos')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('gps_puntos').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- TELEFONOS ----

export const telefonosDB = {
  async list(perreraId: string): Promise<Telefono[]> {
    const { data, error } = await supabase
      .from('telefonos')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('nombre', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, data: Omit<Telefono, 'id' | 'created_at'>): Promise<Telefono> {
    const { data: row, error } = await supabase
      .from('telefonos')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async update(id: string, data: Partial<Omit<Telefono, 'id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase.from('telefonos').update(data).eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('telefonos').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- RASTREOS ----

export const rastreosDB = {
  async list(perreraId: string): Promise<Rastreo[]> {
    const { data, error } = await supabase
      .from('rastreos')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, data: Omit<Rastreo, 'id' | 'created_at'>): Promise<Rastreo> {
    const { data: row, error } = await supabase
      .from('rastreos')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('rastreos').delete().eq('id', id);
    if (error) throw error;
  },
};

export const rastreoPuntosDB = {
  async listByRastreo(rastreo_id: string): Promise<RastreoPunto[]> {
    const { data, error } = await supabase
      .from('rastreo_puntos')
      .select('*')
      .eq('rastreo_id', rastreo_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, data: Omit<RastreoPunto, 'id' | 'created_at'>): Promise<RastreoPunto> {
    const { data: row, error } = await supabase
      .from('rastreo_puntos')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('rastreo_puntos').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- COLLARES GPS ----

export const collaresGpsDB = {
  async list(perreraId: string): Promise<CollarGps[]> {
    const { data, error } = await supabase
      .from('collares_gps')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, data: Omit<CollarGps, 'id' | 'created_at' | 'updated_at'>): Promise<CollarGps> {
    const { data: row, error } = await supabase
      .from('collares_gps')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async update(id: string, data: Partial<Omit<CollarGps, 'id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase
      .from('collares_gps')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('collares_gps').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- GASTOS ----

export const gastosDB = {
  async list(perreraId: string): Promise<Gasto[]> {
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, data: Omit<Gasto, 'id' | 'created_at'>): Promise<Gasto> {
    const { data: row, error } = await supabase
      .from('gastos')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async update(id: string, data: Partial<Omit<Gasto, 'id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase.from('gastos').update(data).eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('gastos').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- CRONOMETROS ----

export const cronometrosDB = {
  async listWithPerro(perreraId: string): Promise<(Cronometro & { perro?: { nombre: string; foto: string } })[]> {
    const { data, error } = await supabase
      .from('cronometros')
      .select('*, perro:perros(nombre, foto)')
      .eq('perrera_id', perreraId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as (Cronometro & { perro?: { nombre: string; foto: string } })[];
  },
  async insert(perreraId: string, data: Omit<Cronometro, 'id' | 'created_at'>): Promise<Cronometro> {
    const { data: row, error } = await supabase
      .from('cronometros')
      .insert({ ...data, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return row;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('cronometros').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- CONFIGURACION ----

export const configuracionDB = {
  async get(perreraId: string, clave: string): Promise<string | null> {
    const { data } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('perrera_id', perreraId)
      .eq('clave', clave)
      .maybeSingle();
    return data?.valor ?? null;
  },
  async set(perreraId: string, clave: string, valor: string): Promise<void> {
    await supabase
      .from('configuracion')
      .upsert({ perrera_id: perreraId, clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' });
  },
  async getAll(perreraId: string): Promise<Record<string, string>> {
    const { data } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .eq('perrera_id', perreraId);
    const result: Record<string, string> = {};
    (data ?? []).forEach(r => { result[r.clave] = r.valor; });
    return result;
  },
};

// ---- NOTIFICACIONES VISTAS ----

export const notificacionesDB = {
  async isVista(perreraId: string, salud_id: string, fecha_proximo: string): Promise<boolean> {
    const { data } = await supabase
      .from('notificaciones_vistas')
      .select('id')
      .eq('perrera_id', perreraId)
      .eq('salud_id', salud_id)
      .eq('fecha_proximo', fecha_proximo)
      .maybeSingle();
    return !!data;
  },
  async markVista(perreraId: string, salud_id: string, fecha_proximo: string): Promise<void> {
    await supabase.from('notificaciones_vistas').insert({ perrera_id: perreraId, salud_id, fecha_proximo });
  },
  async listVistas(perreraId: string): Promise<{ salud_id: string; fecha_proximo: string }[]> {
    const { data } = await supabase
      .from('notificaciones_vistas')
      .select('salud_id, fecha_proximo')
      .eq('perrera_id', perreraId);
    return data ?? [];
  },
};
