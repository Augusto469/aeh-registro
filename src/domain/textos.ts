/** Textos legibles de una crisis, compartidos por la interfaz, el informe y el CSV. */
import { duracionHoras } from './crisis';
import { formatoDuracion, formatoFecha } from './fechas';
import {
  ATENCIONES,
  DESENCADENANTES,
  GRAVEDADES,
  PRODROMOS,
  RESPUESTAS,
  ZONAS,
  type Crisis,
  type Tratamiento,
} from './tipos';

export const SIN_DATO = 'Sin dato';

function lista<K extends string>(
  valores: readonly K[] | null,
  etiquetas: Record<K, string>,
  claveOtro: K,
  textoOtro: string,
  vacio: string,
): string {
  if (valores === null) return SIN_DATO;
  if (valores.length === 0) return vacio;
  return valores
    .map((v) => (v === claveOtro && textoOtro.trim() ? `${etiquetas[v]}: ${textoOtro.trim()}` : etiquetas[v]))
    .join(', ');
}

export const textoZonas = (c: Crisis) => lista(c.zonas.length ? c.zonas : null, ZONAS, 'otra', c.zonaOtra, '');
export const textoProdromos = (c: Crisis) => lista(c.prodromos, PRODROMOS, 'otro', c.prodromoOtro, 'Ninguno');
export const textoDesencadenantes = (c: Crisis) =>
  lista(c.desencadenantes, DESENCADENANTES, 'otro', c.desencadenanteOtro, 'Ninguno');
export const textoGravedad = (c: Crisis) => (c.gravedad ? GRAVEDADES[c.gravedad] : SIN_DATO);
export const textoAtencion = (c: Crisis) => (c.atencion ? ATENCIONES[c.atencion] : SIN_DATO);
export const textoInicio = (c: Crisis) => formatoFecha(c.inicio, c.sinHora);
export const textoFin = (c: Crisis) => (c.fin ? formatoFecha(c.fin, c.sinHora) : 'En curso');

export function textoDuracion(c: Crisis): string {
  const h = duracionHoras(c);
  if (h === null) return 'En curso';
  return c.sinHora ? `aprox. ${Math.round(h / 24)} d` : formatoDuracion(h);
}

export function textoTratamiento(t: Tratamiento): string {
  const partes = [t.medicamento.trim() || 'Sin especificar'];
  if (t.dosis.trim()) partes.push(t.dosis.trim());
  if (t.hora) partes.push(formatoFecha(t.hora));
  partes.push(t.respuesta ? RESPUESTAS[t.respuesta] : 'respuesta sin dato');
  return partes.join(' - ');
}

export function textoMedicacion(c: Crisis, separador = '\n'): string {
  if (c.tratamientos === null) return SIN_DATO;
  if (c.tratamientos.length === 0) return 'No usó';
  return c.tratamientos.map(textoTratamiento).join(separador);
}

/** "05/03/2026 16:00 - Moderada - nota", un momento por línea y en orden. */
export function textoEvolucion(c: Crisis, separador = '\n'): string {
  return [...(c.evolucion ?? [])]
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .map((e) => [formatoFecha(e.hora), e.gravedad ? GRAVEDADES[e.gravedad] : '', e.nota.trim()].filter(Boolean).join(' - '))
    .join(separador);
}

export const textoDiasPerdidos = (c: Crisis) => (c.diasPerdidos === null ? SIN_DATO : String(c.diasPerdidos).replace('.', ','));
