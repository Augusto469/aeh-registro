/**
 * Tratamiento preventivo: qué tomas tocan cada día y cuántas se cumplieron.
 * Funciones puras; la app solo recuerda lo que la persona cargó, no indica tratamientos.
 */
import { nuevoId } from './crisis';
import { diasEntre, soloFecha, sumarDias } from './fechas';
import type { FechaHoraLocal, FechaLocal, Periodo, PlanProfilaxis, Toma } from './tipos';

const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

export const idToma = (planId: string, fecha: FechaLocal, horario: string): string => `${planId}|${fecha}|${horario}`;

export function crearPlan(datos: Partial<PlanProfilaxis> & Pick<PlanProfilaxis, 'medicamento' | 'desde'>): PlanProfilaxis {
  const ahora = new Date().toISOString();
  return {
    id: nuevoId(),
    dosis: '',
    horarios: ['08:00'],
    cadaDias: 1,
    hasta: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
    eliminadoEn: null,
    ...datos,
  };
}

/** Devuelve un mensaje de error o null si el plan se puede guardar. */
export function validarPlan(p: PlanProfilaxis): string | null {
  if (!p.medicamento.trim()) return 'Falta el nombre del medicamento.';
  if (p.horarios.length === 0) return 'Agregá al menos un horario.';
  if (p.horarios.some((h) => !HORARIO.test(h))) return 'Hay un horario que no es una hora válida.';
  if (new Set(p.horarios).size !== p.horarios.length) return 'Hay un horario repetido.';
  if (!Number.isInteger(p.cadaDias) || p.cadaDias < 1 || p.cadaDias > 365) return 'La frecuencia debe ser entre 1 y 365 días.';
  if (!p.desde) return 'Falta la fecha de inicio.';
  if (p.hasta !== null && p.hasta < p.desde) return 'El fin no puede ser anterior al inicio.';
  return null;
}

export const planVigente = (p: PlanProfilaxis, fecha: FechaLocal): boolean =>
  !p.eliminadoEn && fecha >= p.desde && (p.hasta === null || fecha <= p.hasta);

/** ¿Ese día toca tomar según el plan? */
export const tocaEnFecha = (p: PlanProfilaxis, fecha: FechaLocal): boolean =>
  planVigente(p, fecha) && diasEntre(p.desde, fecha) % p.cadaDias === 0;

export function textoFrecuencia(cadaDias: number): string {
  if (cadaDias === 1) return 'todos los días';
  if (cadaDias === 2) return 'día por medio';
  if (cadaDias === 7) return 'una vez por semana';
  return `cada ${cadaDias} días`;
}

export interface TomaDelDia {
  id: string;
  plan: PlanProfilaxis;
  fecha: FechaLocal;
  horario: string;
  tomada: boolean;
  /** Ya pasó la hora y no está marcada */
  atrasada: boolean;
}

/** Tomas que tocan en una fecha, ordenadas por hora. `ahora` decide cuáles están atrasadas. */
export function tomasDelDia(planes: PlanProfilaxis[], tomas: Toma[], fecha: FechaLocal, ahora: FechaHoraLocal): TomaDelDia[] {
  const hechas = new Set(tomas.map((t) => t.id));
  const res: TomaDelDia[] = [];
  for (const plan of planes) {
    if (!tocaEnFecha(plan, fecha)) continue;
    for (const horario of plan.horarios) {
      const id = idToma(plan.id, fecha, horario);
      const tomada = hechas.has(id);
      res.push({ id, plan, fecha, horario, tomada, atrasada: !tomada && `${fecha}T${horario}` < ahora });
    }
  }
  return res.sort((a, b) => a.horario.localeCompare(b.horario) || a.plan.medicamento.localeCompare(b.plan.medicamento));
}

export interface Adherencia {
  /** Tomas cuya hora ya pasó dentro del período */
  esperadas: number;
  tomadas: number;
  /** 0 a 100; null si no había ninguna toma esperada */
  porcentaje: number | null;
}

/**
 * Tomas cumplidas sobre tomas esperadas en el período. Solo cuentan las que ya debían
 * haberse tomado (hasta `ahora`): las de más tarde hoy no bajan el porcentaje.
 */
export function adherencia(planes: PlanProfilaxis[], tomas: Toma[], periodo: Periodo, ahora: FechaHoraLocal): Adherencia {
  const hechas = new Set(tomas.map((t) => t.id));
  const hoy = soloFecha(ahora);
  let esperadas = 0;
  let tomadas = 0;
  for (const plan of planes) {
    if (plan.eliminadoEn) continue;
    const desde = plan.desde > periodo.desde ? plan.desde : periodo.desde;
    let hasta = periodo.hasta < hoy ? periodo.hasta : hoy;
    if (plan.hasta !== null && plan.hasta < hasta) hasta = plan.hasta;
    for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
      if (!tocaEnFecha(plan, f)) continue;
      for (const horario of plan.horarios) {
        const hecha = hechas.has(idToma(plan.id, f, horario));
        // Una toma adelantada (marcada antes de su hora) también cuenta.
        if (!hecha && `${f}T${horario}` > ahora) continue;
        esperadas++;
        if (hecha) tomadas++;
      }
    }
  }
  return { esperadas, tomadas, porcentaje: esperadas ? Math.round((tomadas / esperadas) * 100) : null };
}
