import { duracionHoras } from './crisis';
import * as t from './textos';
import type { Crisis } from './tipos';

const COLUMNAS: [string, (c: Crisis) => string][] = [
  ['inicio', (c) => t.textoInicio(c)],
  ['fin', (c) => (c.fin ? t.textoFin(c) : '')],
  ['en_curso', (c) => (c.fin ? 'no' : 'si')],
  ['solo_dia', (c) => (c.sinHora ? 'si' : 'no')],
  ['duracion_horas', (c) => {
    const h = duracionHoras(c);
    return h === null ? '' : String(Math.round(h * 10) / 10).replace('.', ',');
  }],
  ['zonas', (c) => t.textoZonas(c)],
  ['gravedad', (c) => t.textoGravedad(c)],
  ['sintomas_previos', (c) => t.textoProdromos(c)],
  ['desencadenantes', (c) => t.textoDesencadenantes(c)],
  ['medicacion', (c) => t.textoMedicacion(c, ' | ')],
  ['atencion_medica', (c) => t.textoAtencion(c)],
  ['dias_perdidos', (c) => (c.diasPerdidos === null ? '' : String(c.diasPerdidos))],
  ['evolucion', (c) => t.textoEvolucion(c, ' | ')],
  ['notas', (c) => c.notas],
  ['id', (c) => c.id],
];

function celda(valor: string): string {
  // Excel interpreta como fórmula lo que empieza con = + - @ (por ejemplo una nota
  // "- dolor fuerte" o "=..."). El apóstrofo inicial lo deja como texto.
  const v = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * CSV con ';' como separador y BOM: es lo que Excel en español abre bien
 * con doble clic (con ',' pone todo en una sola columna).
 */
export function crisisACsv(lista: Crisis[]): string {
  const filas = [COLUMNAS.map(([nombre]) => nombre).join(';')];
  for (const c of lista) filas.push(COLUMNAS.map(([, f]) => celda(f(c))).join(';'));
  return '﻿' + filas.join('\r\n') + '\r\n';
}
