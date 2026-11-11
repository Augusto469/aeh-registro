import { ahoraLocal, diasEntre, horasEntre, soloFecha } from './fechas';
import { ZONAS_VIA_AEREA, type Crisis, type FechaLocal, type Periodo } from './tipos';

/** UUID v4. Usa crypto.randomUUID cuando existe (HTTPS/localhost) y si no un respaldo simple. */
export function nuevoId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function crearCrisis(datos: Partial<Crisis> = {}): Crisis {
  const ahora = new Date().toISOString();
  return {
    id: nuevoId(),
    inicio: ahoraLocal(),
    fin: null,
    sinHora: false,
    zonas: [],
    zonaOtra: '',
    gravedad: null,
    prodromos: null,
    prodromoOtro: '',
    desencadenantes: null,
    desencadenanteOtro: '',
    tratamientos: null,
    atencion: null,
    diasPerdidos: null,
    notas: '',
    creadoEn: ahora,
    actualizadoEn: ahora,
    eliminadoEn: null,
    ...datos,
  };
}

export const enCurso = (c: Crisis): boolean => c.fin === null;

/**
 * Duración en horas. Devuelve null si está en curso (salvo que se pase `ahora`).
 * Si solo se conoce el día, se cuentan días completos: del 3 al 5 son 3 días.
 */
export function duracionHoras(c: Crisis, ahora?: string): number | null {
  const fin = c.fin ?? ahora ?? null;
  if (fin === null) return null;
  if (c.sinHora) return (diasEntre(c.inicio, fin) + 1) * 24;
  return Math.max(0, horasEntre(c.inicio, fin));
}

/** Nombres de los campos que faltan cargar (para "completar después"). */
export function camposPendientes(c: Crisis): string[] {
  const p: string[] = [];
  if (c.zonas.length === 0) p.push('zonas');
  if (c.gravedad === null) p.push('gravedad');
  if (c.prodromos === null) p.push('síntomas previos');
  if (c.desencadenantes === null) p.push('desencadenante');
  if (c.tratamientos === null) p.push('medicación');
  if (c.atencion === null) p.push('atención médica');
  if (c.diasPerdidos === null) p.push('impacto');
  return p;
}

export const estaIncompleta = (c: Crisis): boolean => camposPendientes(c).length > 0;

export const afectaViaAerea = (c: Crisis): boolean => c.zonas.some((z) => ZONAS_VIA_AEREA.includes(z));

/** Devuelve un mensaje de error o null si la crisis se puede guardar. */
export function validarCrisis(c: Crisis): string | null {
  if (!c.inicio) return 'Falta la fecha de inicio.';
  if (c.fin !== null && c.fin < c.inicio) return 'El fin no puede ser anterior al inicio.';
  if (c.diasPerdidos !== null && (c.diasPerdidos < 0 || !Number.isFinite(c.diasPerdidos)))
    return 'Los días perdidos deben ser un número positivo.';
  return null;
}

/** Una crisis pertenece a un período según su fecha de inicio. */
export function enPeriodo(c: Crisis, p: Periodo): boolean {
  const f = soloFecha(c.inicio);
  return f >= p.desde && f <= p.hasta;
}

/** ¿La crisis estaba activa ese día? (para el calendario). Las en curso llegan hasta `hoy`. */
export function activaEnDia(c: Crisis, dia: FechaLocal, hoy: FechaLocal): boolean {
  const ini = soloFecha(c.inicio);
  const fin = c.fin ? soloFecha(c.fin) : hoy;
  return dia >= ini && dia <= (fin < ini ? ini : fin);
}

export interface Filtros {
  desde?: FechaLocal;
  hasta?: FechaLocal;
  zona?: string;
  gravedad?: string;
  /** 'con' | 'sin' */
  medicacion?: string;
  soloIncompletas?: boolean;
}

export function filtrarCrisis(lista: Crisis[], f: Filtros): Crisis[] {
  return lista.filter((c) => {
    const dia = soloFecha(c.inicio);
    if (f.desde && dia < f.desde) return false;
    if (f.hasta && dia > f.hasta) return false;
    if (f.zona && !c.zonas.includes(f.zona as never)) return false;
    if (f.gravedad && c.gravedad !== f.gravedad) return false;
    if (f.medicacion === 'con' && !(c.tratamientos && c.tratamientos.length > 0)) return false;
    if (f.medicacion === 'sin' && !(c.tratamientos && c.tratamientos.length === 0)) return false;
    if (f.soloIncompletas && !estaIncompleta(c)) return false;
    return true;
  });
}

/** Más recientes primero. */
export function ordenarPorInicio(lista: Crisis[]): Crisis[] {
  return [...lista].sort((a, b) => (a.inicio < b.inicio ? 1 : a.inicio > b.inicio ? -1 : 0));
}
