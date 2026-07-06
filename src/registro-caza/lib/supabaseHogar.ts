import { supabase } from './supabase';
import type { MiembroHogar, Tarea, Rutina, RutinaSemana, ListaCompra, ListaCompraItem } from './types';

const COLORES = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#f97316', '#06b6d4', '#ec4899', '#a3e635'];

export async function listPerreraMiembros(perreraId: string): Promise<MiembroHogar[]> {
  const { data: perrera } = await supabase.from('perreras').select('admin_id').eq('id', perreraId).maybeSingle();
  if (!perrera) return [];

  const [{ data: adminPerfil }, { data: aprobados }] = await Promise.all([
    supabase.from('perfiles').select('id, nombre_completo').eq('id', perrera.admin_id).maybeSingle(),
    supabase.from('perrera_miembros').select('user_id, perfiles(id, nombre_completo)').eq('perrera_id', perreraId).eq('estado', 'aprobado'),
  ]);

  const result: MiembroHogar[] = [];
  if (adminPerfil) {
    result.push({ id: adminPerfil.id, nombre: adminPerfil.nombre_completo ?? 'Admin', color: COLORES[0], foto: '', perrera_id: perreraId, created_at: '' });
  }
  (aprobados ?? []).forEach((m: any, i: number) => {
    if (m.perfiles && m.user_id !== perrera.admin_id) {
      result.push({ id: m.user_id, nombre: (m.perfiles as any).nombre_completo ?? m.user_id, color: COLORES[(i + 1) % COLORES.length], foto: '', perrera_id: perreraId, created_at: '' });
    }
  });
  return result;
}

// ---- MIEMBROS HOGAR ----

export const miembrosDB = {
  async list(perreraId: string): Promise<MiembroHogar[]> {
    const { data, error } = await supabase
      .from('miembros_hogar')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async insert(perreraId: string, nombre: string, color: string, foto = ''): Promise<MiembroHogar> {
    const { data, error } = await supabase
      .from('miembros_hogar')
      .insert({ nombre, color, foto, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async update(id: string, nombre: string, color: string, foto = ''): Promise<void> {
    const { error } = await supabase
      .from('miembros_hogar')
      .update({ nombre, color, foto })
      .eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('miembros_hogar').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- TAREAS ----

export const tareasDB = {
  async list(perreraId: string): Promise<Tarea[]> {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('completada', { ascending: true })
      .order('fecha', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Tarea[];
  },
  async insert(perreraId: string, payload: {
    titulo: string;
    descripcion: string;
    miembro_id: string | null;
    fecha: string | null;
  }): Promise<void> {
    const { error } = await supabase.from('tareas').insert({ ...payload, perrera_id: perreraId });
    if (error) throw error;
  },
  async update(id: string, payload: Partial<Omit<Tarea, 'id' | 'created_at' | 'miembro'>>): Promise<void> {
    const { error } = await supabase.from('tareas').update(payload).eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('tareas').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- RUTINAS ----

export const rutinasDB = {
  async list(perreraId: string): Promise<Rutina[]> {
    const { data, error } = await supabase
      .from('rutinas')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Rutina[];
  },
  async insert(perreraId: string, payload: {
    titulo: string;
    descripcion: string;
    hora: string;
    dias_semana: string;
    miembro_id: string | null;
  }): Promise<Rutina> {
    const { data, error } = await supabase
      .from('rutinas')
      .insert({ ...payload, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async update(id: string, payload: Partial<Omit<Rutina, 'id' | 'created_at' | 'miembro'>>): Promise<void> {
    const { error } = await supabase.from('rutinas').update(payload).eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('rutinas').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- RUTINA SEMANAS ----

export const rutinaSemanas = {
  async listByRutina(rutina_id: string): Promise<RutinaSemana[]> {
    const { data, error } = await supabase
      .from('rutina_semanas')
      .select('*')
      .eq('rutina_id', rutina_id)
      .order('fecha_lunes', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async programar(perreraId: string, rutina_id: string, semanas: number): Promise<void> {
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diff);

    const rows: { rutina_id: string; fecha_lunes: string; perrera_id: string }[] = [];
    for (let i = 0; i < semanas; i++) {
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + i * 7);
      rows.push({
        rutina_id,
        fecha_lunes: fecha.toISOString().split('T')[0],
        perrera_id: perreraId,
      });
    }

    const { error } = await supabase
      .from('rutina_semanas')
      .upsert(rows, { onConflict: 'rutina_id,fecha_lunes', ignoreDuplicates: true });
    if (error) throw error;
  },
  async toggleCompletada(id: string, completada: boolean): Promise<void> {
    const { error } = await supabase
      .from('rutina_semanas')
      .update({ completada })
      .eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('rutina_semanas').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- LISTA DE LA COMPRA ----

export const listaCompraDB = {
  async list(perreraId: string): Promise<ListaCompra[]> {
    const { data, error } = await supabase
      .from('lista_compra')
      .select('*')
      .eq('perrera_id', perreraId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async getWithItems(id: string): Promise<ListaCompra | null> {
    const { data, error } = await supabase
      .from('lista_compra')
      .select('*, items:lista_compra_items(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const d = data as ListaCompra & { items: ListaCompraItem[] };
    d.items = (d.items ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
    return d;
  },
  async insert(perreraId: string, nombre: string, fecha: string): Promise<ListaCompra> {
    const { data, error } = await supabase
      .from('lista_compra')
      .insert({ nombre, fecha, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async finalizar(id: string, importe_final: number, pagado_por: string): Promise<void> {
    const { error } = await supabase
      .from('lista_compra')
      .update({ finalizada: true, importe_final, pagado_por })
      .eq('id', id);
    if (error) throw error;
  },
  async reabrir(id: string): Promise<void> {
    const { error } = await supabase
      .from('lista_compra')
      .update({ finalizada: false, importe_final: null, pagado_por: '' })
      .eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('lista_compra').delete().eq('id', id);
    if (error) throw error;
  },
};

export const listaCompraItemsDB = {
  async insert(perreraId: string, lista_id: string, nombre: string, cantidad: string): Promise<ListaCompraItem> {
    const { data, error } = await supabase
      .from('lista_compra_items')
      .insert({ lista_id, nombre, cantidad, perrera_id: perreraId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async toggleCogido(id: string, cogido: boolean): Promise<void> {
    const { error } = await supabase
      .from('lista_compra_items')
      .update({ cogido })
      .eq('id', id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('lista_compra_items').delete().eq('id', id);
    if (error) throw error;
  },
};
