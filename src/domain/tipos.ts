/**
 * Modelo de datos. Los catálogos usan códigos estables (claves) y las etiquetas
 * en español van aparte: así se puede cambiar un texto sin migrar datos.
 */

export const ZONAS = {
  extremidades: 'Extremidades',
  cara: 'Cara',
  labios: 'Labios',
  lengua: 'Lengua',
  laringe: 'Garganta / laringe',
  abdomen: 'Abdomen',
  genitales: 'Genitales',
  otra: 'Otra',
} as const;
export type Zona = keyof typeof ZONAS;

/** Zonas con posible compromiso de la vía aérea: se destacan en el informe. */
export const ZONAS_VIA_AEREA: Zona[] = ['lengua', 'laringe'];

export const GRAVEDADES = { leve: 'Leve', moderada: 'Moderada', grave: 'Grave' } as const;
export type Gravedad = keyof typeof GRAVEDADES;

export const PRODROMOS = {
  eritema: 'Eritema marginado',
  cansancio: 'Cansancio',
  hormigueo: 'Hormigueo',
  otro: 'Otro',
} as const;
export type Prodromo = keyof typeof PRODROMOS;

export const DESENCADENANTES = {
  estres: 'Estrés',
  traumatismo: 'Golpe o traumatismo',
  procedimiento: 'Procedimiento dental o médico',
  infeccion: 'Infección',
  medicamento: 'Medicamento',
  hormonal: 'Ciclo hormonal',
  desconocido: 'Desconocido',
  otro: 'Otro',
} as const;
export type Desencadenante = keyof typeof DESENCADENANTES;

export const ATENCIONES = {
  ninguna: 'Ninguna',
  consulta: 'Consulta',
  emergencia: 'Emergencia',
  internacion: 'Internación',
} as const;
export type Atencion = keyof typeof ATENCIONES;

export const RESPUESTAS = { si: 'Funcionó', parcial: 'Parcialmente', no: 'No funcionó' } as const;
export type Respuesta = keyof typeof RESPUESTAS;

/** Fecha y hora "de reloj" sin zona horaria: 'YYYY-MM-DDTHH:mm'. Ver docs/decisiones.md. */
export type FechaHoraLocal = string;
/** 'YYYY-MM-DD' */
export type FechaLocal = string;

export interface Tratamiento {
  id: string;
  medicamento: string;
  dosis: string;
  hora: FechaHoraLocal | null;
  respuesta: Respuesta | null;
}

/**
 * En los campos opcionales, `null` significa "todavía no lo cargué" y es distinto
 * de "ninguno" (lista vacía, 0, 'ninguna'). Así el registro rápido no distorsiona
 * las estadísticas.
 */
export interface Crisis {
  id: string;
  inicio: FechaHoraLocal;
  /** null = crisis en curso */
  fin: FechaHoraLocal | null;
  /** true = solo se recuerda el día (crisis pasadas); la hora guardada es 00:00 y no se muestra */
  sinHora: boolean;
  zonas: Zona[];
  zonaOtra: string;
  gravedad: Gravedad | null;
  prodromos: Prodromo[] | null;
  prodromoOtro: string;
  desencadenantes: Desencadenante[] | null;
  desencadenanteOtro: string;
  tratamientos: Tratamiento[] | null;
  atencion: Atencion | null;
  diasPerdidos: number | null;
  notas: string;
  /** Marcas de tiempo en UTC (ISO 8601), pensadas para una futura sincronización */
  creadoEn: string;
  actualizadoEn: string;
  /** Borrado lógico */
  eliminadoEn: string | null;
}

export interface Medio {
  id: string;
  crisisId: string;
  tipo: 'foto' | 'video';
  blob: Blob;
  mime: string;
  nombre: string;
  creadoEn: string;
}

export interface Medicamento {
  id: string;
  nombre: string;
  dosisHabitual: string;
}

export interface Perfil {
  nombre: string;
  documento: string;
  fechaNacimiento: string;
  diagnostico: string;
  profilaxis: string;
  medico: string;
}

export const PERFIL_VACIO: Perfil = {
  nombre: '',
  documento: '',
  fechaNacimiento: '',
  diagnostico: '',
  profilaxis: '',
  medico: '',
};

export const MEDICAMENTOS_INICIALES: Omit<Medicamento, 'id'>[] = [
  { nombre: 'Ácido tranexámico', dosisHabitual: '' },
  { nombre: 'Icatibant', dosisHabitual: '30 mg subcutáneo' },
  { nombre: 'Concentrado de C1 inhibidor (plasmático)', dosisHabitual: '' },
  { nombre: 'C1 inhibidor recombinante', dosisHabitual: '' },
  { nombre: 'Plasma fresco congelado', dosisHabitual: '' },
];

export interface Periodo {
  desde: FechaLocal;
  hasta: FechaLocal;
}
