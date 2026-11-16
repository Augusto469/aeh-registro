/**
 * Formato del respaldo JSON. Lleva `version` para poder migrar respaldos viejos
 * si el modelo cambia. Al importar se valida todo con Zod: un archivo roto o de
 * otra app no llega a tocar la base de datos.
 */
import { z } from 'zod';
import {
  ATENCIONES,
  DESENCADENANTES,
  GRAVEDADES,
  PRODROMOS,
  RESPUESTAS,
  ZONAS,
  type Crisis,
  type Medicamento,
  type Perfil,
  type PlanProfilaxis,
  type Toma,
} from './tipos';

export const APP_ID = 'aeh-registro';
export const VERSION_RESPALDO = 1;

const claves = <T extends Record<string, string>>(o: T) =>
  z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

/** ¿'YYYY-MM-DD...' es un día que existe? (rechaza 2026-13-45 o 2026-02-30) */
function diaReal(s: string): boolean {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

// El archivo puede venir de cualquier lado: las fechas se validan enteras (no solo el
// comienzo del texto), porque el resto de la app las compara y ordena como texto.
// Se aceptan segundos por si algún navegador los agrega, y se descartan.
const fechaHora = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?$/)
  .refine(diaReal)
  .transform((s) => s.slice(0, 16));
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(diaReal);
const horario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
/** Marca de tiempo en UTC como la escribe `toISOString()`: es la que decide qué versión gana al fusionar. */
const marcaUtc = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/)
  .refine((s) => !Number.isNaN(Date.parse(s)));
/** Los ids van a parar a rutas (#/crisis/<id>) y a claves de la base: solo caracteres seguros. */
const id = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/)
  .refine((s) => s !== 'nueva'); // '/crisis/nueva' es la pantalla de crisis nueva

const tratamiento = z.object({
  id,
  medicamento: z.string(),
  dosis: z.string(),
  hora: fechaHora.nullable(),
  respuesta: claves(RESPUESTAS).nullable(),
});

const crisis = z.object({
  id,
  inicio: fechaHora,
  fin: fechaHora.nullable(),
  sinHora: z.boolean(),
  zonas: z.array(claves(ZONAS)),
  zonaOtra: z.string(),
  gravedad: claves(GRAVEDADES).nullable(),
  prodromos: z.array(claves(PRODROMOS)).nullable(),
  prodromoOtro: z.string(),
  desencadenantes: z.array(claves(DESENCADENANTES)).nullable(),
  desencadenanteOtro: z.string(),
  tratamientos: z.array(tratamiento).nullable(),
  atencion: claves(ATENCIONES).nullable(),
  diasPerdidos: z.number().nonnegative().nullable(),
  notas: z.string(),
  // Campos agregados después de la versión 1: opcionales para aceptar respaldos anteriores.
  evolucion: z
    .array(z.object({ id, hora: fechaHora, gravedad: claves(GRAVEDADES).nullable(), nota: z.string() }))
    .optional(),
  creadoEn: marcaUtc,
  actualizadoEn: marcaUtc,
  eliminadoEn: marcaUtc.nullable(),
});

const medioSerializado = z.object({
  id,
  crisisId: id,
  tipo: z.enum(['foto', 'video']),
  mime: z.string(),
  nombre: z.string(),
  creadoEn: z.string(),
  /** Contenido en base64 */
  datos: z.string(),
});
export type MedioSerializado = z.infer<typeof medioSerializado>;

const esquema = z.object({
  app: z.literal(APP_ID),
  version: z.number().int().positive(),
  exportadoEn: z.string(),
  crisis: z.array(crisis),
  medicamentos: z.array(
    z.object({
      id,
      nombre: z.string(),
      dosisHabitual: z.string(),
      stock: z.number().nonnegative().nullable().optional(),
      stockMinimo: z.number().nonnegative().nullable().optional(),
      vencimiento: z.union([fecha, z.literal('')]).optional(),
    }),
  ),
  perfil: z
    .object({
      nombre: z.string(),
      documento: z.string(),
      fechaNacimiento: z.string(),
      diagnostico: z.string(),
      profilaxis: z.string(),
      medico: z.string(),
    })
    .nullable(),
  medios: z.array(medioSerializado).optional(),
  planes: z
    .array(
      z.object({
        id,
        medicamento: z.string(),
        dosis: z.string(),
        horarios: z.array(horario),
        cadaDias: z.number().int().min(1).max(365),
        desde: fecha,
        hasta: fecha.nullable(),
        creadoEn: marcaUtc,
        actualizadoEn: marcaUtc,
        eliminadoEn: marcaUtc.nullable(),
      }),
    )
    .optional(),
  tomas: z
    .array(z.object({ id: z.string().min(1).max(200), planId: id, fecha, horario, tomadaEn: z.string() }))
    .optional(),
});

export interface Respaldo {
  app: typeof APP_ID;
  version: number;
  exportadoEn: string;
  crisis: Crisis[];
  medicamentos: Medicamento[];
  perfil: Perfil | null;
  medios?: MedioSerializado[];
  planes?: PlanProfilaxis[];
  tomas?: Toma[];
}

export function crearRespaldo(datos: Omit<Respaldo, 'app' | 'version' | 'exportadoEn'>, ahora = new Date()): Respaldo {
  return { app: APP_ID, version: VERSION_RESPALDO, exportadoEn: ahora.toISOString(), ...datos };
}

/** Valida el texto de un respaldo. Lanza un Error con mensaje en español si no sirve. */
export function parsearRespaldo(texto: string): Respaldo {
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const r = esquema.safeParse(json);
  if (!r.success) {
    const p = r.error.issues[0];
    // Solo el lugar del problema: el mensaje de la librería de validación está en inglés.
    throw new Error(`El archivo no es un respaldo válido de esta app (problema en "${p.path.join('.') || 'el archivo'}").`);
  }
  if (r.data.version > VERSION_RESPALDO)
    throw new Error('El respaldo fue creado con una versión más nueva de la app. Actualizá la app e intentá de nuevo.');
  return r.data as Respaldo;
}

export interface ResultadoFusion<T = Crisis> {
  /** Registros que hay que escribir en la base */
  aGuardar: T[];
  nuevas: number;
  actualizadas: number;
  sinCambios: number;
}

/**
 * Importar no borra nada: fusiona por id y, si una crisis existe en los dos lados,
 * gana la que se modificó más tarde. Es la misma regla que usaría una sincronización simple.
 */
export function fusionarCrisis<T extends { id: string; actualizadoEn: string } = Crisis>(
  locales: T[],
  importadas: T[],
): ResultadoFusion<T> {
  const porId = new Map(locales.map((c) => [c.id, c]));
  const res: ResultadoFusion<T> = { aGuardar: [], nuevas: 0, actualizadas: 0, sinCambios: 0 };
  for (const imp of importadas) {
    const local = porId.get(imp.id);
    if (!local) {
      res.aGuardar.push(imp);
      res.nuevas++;
    } else if (imp.actualizadoEn > local.actualizadoEn) {
      res.aGuardar.push(imp);
      res.actualizadas++;
    } else {
      res.sinCambios++;
    }
  }
  return res;
}
