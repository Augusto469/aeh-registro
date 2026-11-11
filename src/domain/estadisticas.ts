/**
 * Estadísticas: funciones puras sobre una lista de crisis (sin React ni base de datos).
 * Quien llama decide el período y filtra antes con `enPeriodo`.
 */
import { afectaViaAerea, duracionHoras } from './crisis';
import { claveMes, horasEntre, mesesEntre } from './fechas';
import {
  ATENCIONES,
  DESENCADENANTES,
  GRAVEDADES,
  PRODROMOS,
  ZONAS,
  type Atencion,
  type Crisis,
  type Gravedad,
  type Periodo,
} from './tipos';

export interface Conteo {
  clave: string;
  etiqueta: string;
  cantidad: number;
}

/** Crisis por mes (según fecha de inicio), incluyendo los meses sin crisis. */
export function crisisPorMes(lista: Crisis[], periodo: Periodo): { mes: string; cantidad: number }[] {
  const cuenta = new Map<string, number>();
  for (const c of lista) cuenta.set(claveMes(c.inicio), (cuenta.get(claveMes(c.inicio)) ?? 0) + 1);
  return mesesEntre(periodo.desde, periodo.hasta).map((mes) => ({ mes, cantidad: cuenta.get(mes) ?? 0 }));
}

function contar<K extends string>(
  lista: Crisis[],
  etiquetas: Record<K, string>,
  valores: (c: Crisis) => readonly K[] | null,
): Conteo[] {
  const cuenta = new Map<K, number>();
  for (const c of lista) for (const v of valores(c) ?? []) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  return [...cuenta.entries()]
    .map(([clave, cantidad]) => ({ clave, etiqueta: etiquetas[clave], cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.etiqueta.localeCompare(b.etiqueta));
}

/** En cuántas crisis aparece cada zona (una crisis puede sumar a varias). */
export const frecuenciaZonas = (lista: Crisis[]) => contar(lista, ZONAS, (c) => c.zonas);
export const frecuenciaDesencadenantes = (lista: Crisis[]) => contar(lista, DESENCADENANTES, (c) => c.desencadenantes);
export const frecuenciaProdromos = (lista: Crisis[]) => contar(lista, PRODROMOS, (c) => c.prodromos);
export const frecuenciaGravedad = (lista: Crisis[]) =>
  contar(lista, GRAVEDADES, (c) => (c.gravedad ? [c.gravedad] : null));
export const frecuenciaAtencion = (lista: Crisis[]) =>
  contar(lista, ATENCIONES, (c) => (c.atencion ? [c.atencion] : null));

export interface UsoMedicamento {
  medicamento: string;
  /** Cantidad de dosis registradas */
  usos: number;
  /** Cantidad de crisis en las que se usó */
  crisis: number;
  funciono: number;
  parcial: number;
  noFunciono: number;
  sinDato: number;
}

export function usoMedicacion(lista: Crisis[]): UsoMedicamento[] {
  const mapa = new Map<string, UsoMedicamento>();
  for (const c of lista) {
    const vistos = new Set<string>();
    for (const t of c.tratamientos ?? []) {
      const nombre = t.medicamento.trim() || 'Sin especificar';
      let u = mapa.get(nombre);
      if (!u) {
        u = { medicamento: nombre, usos: 0, crisis: 0, funciono: 0, parcial: 0, noFunciono: 0, sinDato: 0 };
        mapa.set(nombre, u);
      }
      u.usos++;
      if (!vistos.has(nombre)) {
        u.crisis++;
        vistos.add(nombre);
      }
      if (t.respuesta === 'si') u.funciono++;
      else if (t.respuesta === 'parcial') u.parcial++;
      else if (t.respuesta === 'no') u.noFunciono++;
      else u.sinDato++;
    }
  }
  return [...mapa.values()].sort((a, b) => b.usos - a.usos || a.medicamento.localeCompare(b.medicamento));
}

export interface Resumen {
  total: number;
  enCurso: number;
  porGravedad: Record<Gravedad, number>;
  sinGravedad: number;
  viaAerea: number;
  /** Crisis con al menos una dosis de medicación de rescate */
  tratadas: number;
  /** Crisis donde se registró explícitamente que no se usó medicación */
  noTratadas: number;
  porAtencion: Record<Atencion, number>;
  diasPerdidos: number;
  /** Promedio de las crisis cerradas; null si no hay ninguna */
  duracionMediaHoras: number | null;
  duracionMaximaHoras: number | null;
  /** Promedio entre el inicio y la primera dosis, solo con horas conocidas */
  horasHastaTratamiento: number | null;
  /** Promedio de crisis por mes del período */
  crisisPorMes: number;
}

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function resumen(lista: Crisis[], periodo: Periodo): Resumen {
  const r: Resumen = {
    total: lista.length,
    enCurso: 0,
    porGravedad: { leve: 0, moderada: 0, grave: 0 },
    sinGravedad: 0,
    viaAerea: 0,
    tratadas: 0,
    noTratadas: 0,
    porAtencion: { ninguna: 0, consulta: 0, emergencia: 0, internacion: 0 },
    diasPerdidos: 0,
    duracionMediaHoras: null,
    duracionMaximaHoras: null,
    horasHastaTratamiento: null,
    crisisPorMes: 0,
  };
  const duraciones: number[] = [];
  const demoras: number[] = [];
  for (const c of lista) {
    if (c.fin === null) r.enCurso++;
    if (c.gravedad) r.porGravedad[c.gravedad]++;
    else r.sinGravedad++;
    if (afectaViaAerea(c)) r.viaAerea++;
    if (c.tratamientos) {
      if (c.tratamientos.length > 0) r.tratadas++;
      else r.noTratadas++;
    }
    if (c.atencion) r.porAtencion[c.atencion]++;
    r.diasPerdidos += c.diasPerdidos ?? 0;
    const d = duracionHoras(c);
    if (d !== null) duraciones.push(d);
    if (!c.sinHora) {
      const horas = (c.tratamientos ?? [])
        .map((t) => t.hora)
        .filter((h): h is string => !!h)
        .sort();
      if (horas.length) {
        const demora = horasEntre(c.inicio, horas[0]);
        if (demora >= 0) demoras.push(demora);
      }
    }
  }
  r.duracionMediaHoras = promedio(duraciones);
  r.duracionMaximaHoras = duraciones.length ? Math.max(...duraciones) : null;
  r.horasHastaTratamiento = promedio(demoras);
  const meses = mesesEntre(periodo.desde, periodo.hasta).length || 1;
  r.crisisPorMes = lista.length / meses;
  return r;
}
