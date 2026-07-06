export interface Perro {
  id: string;
  nombre: string;
  raza: string;
  fecha_nacimiento: string | null;
  sexo: string;
  chip: string;
  peso: number | null;
  padre: string;
  madre: string;
  notas: string;
  foto: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface PerroHistorial {
  id: string;
  perro_id: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  created_at: string;
}

export interface Caceria {
  id: string;
  fecha: string;
  lugar: string;
  modalidad: string;
  notas: string;
  created_at: string;
  animales?: CaceriaAnimal[];
  perros_participantes?: CaceriaPerro[];
}

export interface CaceriaAnimal {
  id: string;
  caceria_id: string;
  especie: string;
  cazados: number;
  movidos: number;
  escapados: number;
  perdidos?: number;
}

export interface CaceriaPerroEspecie {
  especie: string;
  cantidad: number;
}

export interface CaceriaPerroEspecies {
  levantados: CaceriaPerroEspecie[];
  perseguidos: CaceriaPerroEspecie[];
  perdidos: CaceriaPerroEspecie[];
  muertes: CaceriaPerroEspecie[];
  cobradas: CaceriaPerroEspecie[];
  amuestra: CaceriaPerroEspecie[];
}

export interface CaceriaPerro {
  id: string;
  caceria_id: string;
  perro_id: string;
  levantados: number;
  perseguidos: number;
  perdidos: number;
  muertes: number;
  duracion_minutos: number;
  perro?: Perro;
  especies?: CaceriaPerroEspecies;
}

export interface Salud {
  id: string;
  perro_id: string;
  tipo: string;
  fecha: string;
  fecha_proximo: string | null;
  avisar_dias_antes: number;
  repetir_valor: number;
  repetir_unidad: string;
  notas: string;
  foto: string;
  created_at: string;
  perro?: Perro;
}

export interface GpsPunto {
  id: string;
  nombre: string;
  tipo: string;
  latitud: number | null;
  longitud: number | null;
  fecha_hora: string;
  notas: string;
  created_at: string;
}

export interface Telefono {
  id: string;
  nombre: string;
  telefono: string;
  tipo: string;
  notas: string;
  created_at: string;
}

export interface Rastreo {
  id: string;
  nombre: string;
  fecha: string;
  notas: string;
  created_at: string;
  puntos?: RastreoPunto[];
}

export interface RastreoPunto {
  id: string;
  rastreo_id: string;
  latitud: number;
  longitud: number;
  animal: 'jabali' | 'ciervo' | 'corzo' | 'zorro';
  notas: string;
  direccion: number | null;
  created_at: string;
}

export interface CollarGps {
  id: string;
  nombre: string;
  id_collar: string;
  codigo_adiestramiento: string;
  notas: string;
  created_at: string;
  updated_at: string;
}

export interface Gasto {
  id: string;
  fecha: string;
  categoria: string;
  descripcion: string;
  importe: number;
  notas: string;
  pagado_por: string;
  created_at: string;
}

export interface MiembroHogar {
  id: string;
  nombre: string;
  color: string;
  foto: string;
  created_at: string;
  perrera_id?: string;
}

export interface ListaCompra {
  id: string;
  nombre: string;
  fecha: string;
  finalizada: boolean;
  importe_final: number | null;
  pagado_por: string;
  created_at: string;
  items?: ListaCompraItem[];
}

export interface ListaCompraItem {
  id: string;
  lista_id: string;
  nombre: string;
  cantidad: string;
  cogido: boolean;
  created_at: string;
}

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string;
  miembro_id: string | null;
  fecha: string | null;
  completada: boolean;
  created_at: string;
  miembro?: MiembroHogar;
}

export interface Rutina {
  id: string;
  titulo: string;
  descripcion: string;
  hora: string;
  dias_semana: string;
  miembro_id: string | null;
  created_at: string;
  miembro?: MiembroHogar;
}

export interface RutinaSemana {
  id: string;
  rutina_id: string;
  fecha_lunes: string;
  completada: boolean;
  created_at: string;
  rutina?: Rutina;
}

export interface Cronometro {
  id: string;
  perro_id: string;
  fecha: string;
  duracion_segundos: number;
  notas: string;
  created_at: string;
  perro?: Perro;
}
