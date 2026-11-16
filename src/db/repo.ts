/**
 * Repositorio: la única capa que habla con IndexedDB. Las pantallas llaman a estas
 * funciones; si algún día hay backend o sincronización, se cambia acá y no en la interfaz.
 */
import { ordenarPorInicio } from '../domain/crisis';
import { crearRespaldo, fusionarCrisis, type MedioSerializado, type Respaldo } from '../domain/respaldo';
import { PERFIL_VACIO, type Crisis, type Medicamento, type Medio, type Perfil } from '../domain/tipos';
import { db } from './db';

// ---------- Crisis ----------

/** Crisis no eliminadas, más recientes primero. */
export async function listarCrisis(): Promise<Crisis[]> {
  const todas = await db.crisis.toArray();
  return ordenarPorInicio(todas.filter((c) => !c.eliminadoEn));
}

export async function obtenerCrisis(id: string): Promise<Crisis | undefined> {
  const c = await db.crisis.get(id);
  return c && !c.eliminadoEn ? c : undefined;
}

export async function guardarCrisis(c: Crisis): Promise<void> {
  await db.crisis.put({ ...c, actualizadoEn: new Date().toISOString() });
}

/** Borrado lógico de la crisis (queda la marca para sincronizar) y borrado real de sus archivos. */
export async function eliminarCrisis(id: string): Promise<void> {
  await db.transaction('rw', db.crisis, db.medios, async () => {
    const c = await db.crisis.get(id);
    if (c) {
      const ahora = new Date().toISOString();
      await db.crisis.put({ ...c, eliminadoEn: ahora, actualizadoEn: ahora });
    }
    await db.medios.where('crisisId').equals(id).delete();
  });
}

// ---------- Fotos y videos ----------

export const listarMedios = (crisisId: string): Promise<Medio[]> =>
  db.medios.where('crisisId').equals(crisisId).sortBy('creadoEn');

export async function agregarMedio(m: Medio): Promise<void> {
  await db.medios.put(m);
}

export async function eliminarMedio(id: string): Promise<void> {
  await db.medios.delete(id);
}

// ---------- Borradores ----------
// Lo que se está cargando en el formulario y todavía no se guardó. Vive en `ajustes`
// (clave 'borrador:<id>', o 'borrador:nueva' para una crisis nueva) para no cambiar el
// esquema. No viaja en el respaldo ni cuenta en las estadísticas.

const PREFIJO_BORRADOR = 'borrador:';

export async function obtenerBorrador(id: string): Promise<Crisis | undefined> {
  const a = await db.ajustes.get(PREFIJO_BORRADOR + id);
  return a ? (a.valor as Crisis) : undefined;
}

export async function guardarBorrador(id: string, c: Crisis): Promise<void> {
  await db.ajustes.put({ clave: PREFIJO_BORRADOR + id, valor: c });
}

export async function eliminarBorrador(id: string): Promise<void> {
  await db.ajustes.delete(PREFIJO_BORRADOR + id);
}

/**
 * Borra archivos de crisis que nunca se guardaron (por ejemplo, si se cerró la app a mitad
 * de carga). Los de una crisis con borrador pendiente se conservan.
 */
export async function limpiarMediosHuerfanos(): Promise<void> {
  const ids = new Set((await db.crisis.toArray()).filter((c) => !c.eliminadoEn).map((c) => c.id));
  for (const b of await db.ajustes.where('clave').startsWith(PREFIJO_BORRADOR).toArray()) {
    const id = (b.valor as Crisis | undefined)?.id;
    if (id) ids.add(id);
  }
  const huerfanos = (await db.medios.toArray()).filter((m) => !ids.has(m.crisisId)).map((m) => m.id);
  if (huerfanos.length) await db.medios.bulkDelete(huerfanos);
}

// ---------- Medicamentos y ajustes ----------

export async function listarMedicamentos(): Promise<Medicamento[]> {
  const ms = await db.medicamentos.toArray();
  return ms.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function guardarMedicamento(m: Medicamento): Promise<void> {
  await db.medicamentos.put(m);
}

export async function eliminarMedicamento(id: string): Promise<void> {
  await db.medicamentos.delete(id);
}

async function leerAjuste<T>(clave: string, porDefecto: T): Promise<T> {
  const a = await db.ajustes.get(clave);
  return a ? (a.valor as T) : porDefecto;
}

export const obtenerPerfil = () => leerAjuste<Perfil>('perfil', PERFIL_VACIO);
export const guardarPerfil = (p: Perfil) => db.ajustes.put({ clave: 'perfil', valor: p });
/** Fecha ISO del último respaldo exportado, o null si nunca se hizo. */
export const obtenerUltimoRespaldo = () => leerAjuste<string | null>('ultimoRespaldo', null);

// ---------- Respaldo ----------

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(blob);
  });
}

function base64ABlob(datos: string, mime: string): Blob {
  const bin = atob(datos);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportarRespaldo(incluirMedios: boolean): Promise<Respaldo> {
  const [crisis, medicamentos, perfil] = await Promise.all([
    db.crisis.toArray(), // incluye las eliminadas: sus marcas viajan en el respaldo
    db.medicamentos.toArray(),
    obtenerPerfil(),
  ]);
  let medios: MedioSerializado[] | undefined;
  if (incluirMedios) {
    medios = [];
    for (const m of await db.medios.toArray()) {
      const { blob, ...resto } = m;
      medios.push({ ...resto, datos: await blobABase64(blob) });
    }
  }
  return crearRespaldo({ crisis, medicamentos, perfil, medios });
}

/**
 * Anota la fecha del último respaldo. Se llama recién cuando el archivo salió de la app
 * (descarga o compartir confirmado): si se cancela, el aviso de "sin respaldo" sigue vigente.
 */
export async function registrarRespaldoHecho(exportadoEn: string): Promise<void> {
  await db.ajustes.put({ clave: 'ultimoRespaldo', valor: exportadoEn });
}

export interface ResultadoImportacion {
  nuevas: number;
  actualizadas: number;
  sinCambios: number;
  medios: number;
}

/** Fusiona un respaldo ya validado con los datos locales. No borra nada. */
export async function importarRespaldo(r: Respaldo): Promise<ResultadoImportacion> {
  return db.transaction('rw', db.crisis, db.medios, db.medicamentos, db.ajustes, async () => {
    const fusion = fusionarCrisis(await db.crisis.toArray(), r.crisis);
    await db.crisis.bulkPut(fusion.aGuardar);

    // Medicamentos: se agregan los que no existen ni por nombre ni por id
    // (si acá se renombró uno, el respaldo no lo pisa).
    const locales = await db.medicamentos.toArray();
    const nombres = new Set(locales.map((m) => m.nombre.trim().toLowerCase()));
    const idsMedicamentos = new Set(locales.map((m) => m.id));
    for (const m of r.medicamentos) {
      const nombre = m.nombre.trim().toLowerCase();
      if (nombres.has(nombre) || idsMedicamentos.has(m.id)) continue;
      await db.medicamentos.put(m);
      nombres.add(nombre);
      idsMedicamentos.add(m.id);
    }

    // Perfil: solo se toma si acá está vacío.
    const perfil = await obtenerPerfil();
    if (r.perfil && Object.values(perfil).every((v) => !v)) await guardarPerfil(r.perfil);

    let medios = 0;
    const vivas = new Set((await db.crisis.toArray()).filter((c) => !c.eliminadoEn).map((c) => c.id));
    for (const m of r.medios ?? []) {
      if (!vivas.has(m.crisisId) || (await db.medios.get(m.id))) continue;
      const { datos, ...resto } = m;
      await db.medios.put({ ...resto, blob: base64ABlob(datos, m.mime) });
      medios++;
    }
    // Si llegó una crisis marcada como eliminada, se van también sus archivos locales.
    for (const c of fusion.aGuardar) {
      if (c.eliminadoEn) await db.medios.where('crisisId').equals(c.id).delete();
    }
    return { nuevas: fusion.nuevas, actualizadas: fusion.actualizadas, sinCambios: fusion.sinCambios, medios };
  });
}
