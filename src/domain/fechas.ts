import type { FechaHoraLocal, FechaLocal } from './tipos';

const dos = (n: number) => String(n).padStart(2, '0');

/** Date -> 'YYYY-MM-DDTHH:mm' en hora local (el formato de <input type="datetime-local">). */
export function aLocal(d: Date): FechaHoraLocal {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function ahoraLocal(): FechaHoraLocal {
  return aLocal(new Date());
}

/** 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm' -> Date local. */
export function aDate(s: string): Date {
  const [f, h = '00:00'] = s.split('T');
  const [y, m, d] = f.split('-').map(Number);
  const [hh, mm] = h.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export const soloFecha = (s: string): FechaLocal => s.slice(0, 10);
export const claveMes = (s: string): string => s.slice(0, 7);

export function horasEntre(a: string, b: string): number {
  return (aDate(b).getTime() - aDate(a).getTime()) / 3_600_000;
}

/** Días de calendario entre dos fechas (sin contar horas). */
export function diasEntre(a: string, b: string): number {
  const da = aDate(soloFecha(a));
  const db = aDate(soloFecha(b));
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function sumarDias(f: FechaLocal, n: number): FechaLocal {
  const d = aDate(f);
  d.setDate(d.getDate() + n);
  return soloFecha(aLocal(d));
}

export function sumarMeses(f: FechaLocal, n: number): FechaLocal {
  const d = aDate(f);
  d.setMonth(d.getMonth() + n);
  return soloFecha(aLocal(d));
}

/** Lista de meses 'YYYY-MM' entre dos fechas, ambos incluidos. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const res: string[] = [];
  let [y, m] = claveMes(desde).split('-').map(Number);
  const fin = claveMes(hasta);
  for (;;) {
    const clave = `${y}-${dos(m)}`;
    if (clave > fin) break;
    res.push(clave);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return res;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
];

/** '2026-03' -> 'mar 2026' */
export function nombreMes(clave: string, largo = false): string {
  const [y, m] = clave.split('-').map(Number);
  return `${(largo ? MESES_LARGOS : MESES)[m - 1]} ${y}`;
}

/** '2026-03-05T14:30' -> '05/03/2026 14:30' (o solo la fecha). */
export function formatoFecha(s: string, sinHora = false): string {
  const [f, h] = s.split('T');
  const [y, m, d] = f.split('-');
  const fecha = `${d}/${m}/${y}`;
  return sinHora || !h ? fecha : `${fecha} ${h.slice(0, 5)}`;
}

export function formatoDuracion(horas: number): string {
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `${Math.round(horas)} h`;
  const dias = Math.floor(horas / 24);
  const resto = Math.round(horas - dias * 24);
  return resto ? `${dias} d ${resto} h` : `${dias} d`;
}
