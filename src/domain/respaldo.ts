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

const fechaHora = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const horario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const tratamiento = z.object({
  id: z.string(),
  medicamento: z.string(),
  dosis: z.string(),
  hora: fechaHora.nullable(),
  respuesta: claves(RESPUESTAS).nullable(),
});

const crisis = z.object({
  id: z.string().min(1),
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
    .array(z.object({ id: z.string(), hora: fechaHora, gravedad: claves(GRAVEDADES).nullable(), nota: z.string() }))
    .optional(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
  eliminadoEn: z.string().nullable(),
});

const medioSerializado = z.object({
  id: z.string(),
  crisisId: z.string(),
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
      id: z.string(),
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
        id: z.string().min(1),
        medicamento: z.string(),
        dosis: z.string(),
        horarios: z.array(horario),
        cadaDias: z.number().int().min(1).max(365),
        desde: fecha,
        hasta: fecha.nullable(),
        creadoEn: z.string(),
        actualizadoEn: z.string(),
        eliminadoEn: z.string().nullable(),
      }),
    )
    .optional(),
  tomas: z
    .array(z.object({ id: z.string().min(1), planId: z.string(), fecha, horario, tomadaEn: z.string() }))
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
    throw new Error(`El archivo no es un respaldo válido de esta app (${p.path.join('.') || 'raíz'}: ${p.message}).`);
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
