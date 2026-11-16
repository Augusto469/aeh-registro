/** Avisos de stock y vencimiento de la medicación de rescate. Funciones puras. */
import { diasEntre, formatoFecha } from './fechas';
import type { FechaLocal, Medicamento } from './tipos';

/** Se avisa cuando faltan estos días o menos para el vencimiento. */
export const DIAS_AVISO_VENCIMIENTO = 30;

export interface AvisoMedicacion {
  medicamentoId: string;
  tipo: 'vencido' | 'porVencer' | 'sinStock' | 'pocoStock';
  texto: string;
  /** true = requiere atención ya (vencido o sin stock) */
  urgente: boolean;
}

export function avisosMedicacion(medicamentos: Medicamento[], hoy: FechaLocal): AvisoMedicacion[] {
  const avisos: AvisoMedicacion[] = [];
  for (const m of medicamentos) {
    if (m.vencimiento) {
      const dias = diasEntre(hoy, m.vencimiento);
      if (dias < 0)
        avisos.push({ medicamentoId: m.id, tipo: 'vencido', urgente: true, texto: `${m.nombre}: venció el ${formatoFecha(m.vencimiento)}.` });
      else if (dias <= DIAS_AVISO_VENCIMIENTO)
        avisos.push({
          medicamentoId: m.id,
          tipo: 'porVencer',
          urgente: false,
          texto: `${m.nombre}: vence ${dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`} (${formatoFecha(m.vencimiento)}).`,
        });
    }
    if (m.stock === null || m.stock === undefined) continue;
    if (m.stock <= 0) avisos.push({ medicamentoId: m.id, tipo: 'sinStock', urgente: true, texto: `${m.nombre}: no te queda ninguna unidad.` });
    else if (m.stockMinimo !== null && m.stockMinimo !== undefined && m.stock <= m.stockMinimo)
      avisos.push({
        medicamentoId: m.id,
        tipo: 'pocoStock',
        urgente: false,
        texto: `${m.nombre}: ${m.stock === 1 ? 'te queda 1 unidad' : `te quedan ${m.stock} unidades`}.`,
      });
  }
  // Primero lo urgente.
  return avisos.sort((a, b) => Number(b.urgente) - Number(a.urgente));
}

/**
 * Cuántas unidades descontar de cada medicamento al guardar una crisis: una por cada dosis
 * nueva (que no estaba en la versión guardada antes), buscando el medicamento por nombre.
 * Devuelve un mapa id de medicamento -> unidades.
 */
export function descuentosDeStock(
  dosisNuevas: { medicamento: string }[],
  medicamentos: Medicamento[],
): Map<string, number> {
  const porNombre = new Map(medicamentos.map((m) => [m.nombre.trim().toLowerCase(), m]));
  const res = new Map<string, number>();
  for (const d of dosisNuevas) {
    const m = porNombre.get(d.medicamento.trim().toLowerCase());
    if (!m || m.stock === null || m.stock === undefined) continue; // sin control de stock
    res.set(m.id, (res.get(m.id) ?? 0) + 1);
  }
  return res;
}
