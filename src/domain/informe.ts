/**
 * Arma los datos del informe médico. No sabe nada de PDF: devuelve textos y tablas
 * que después dibuja `features/informe/pdf.ts`. Por eso se puede testear sin navegador.
 */
import { afectaViaAerea, enPeriodo, estaIncompleta } from './crisis';
import {
  crisisPorMes,
  frecuenciaDesencadenantes,
  frecuenciaProdromos,
  diasDelPeriodo,
  frecuenciaZonas,
  resumen,
  usoMedicacion,
  type Conteo,
  type UsoMedicamento,
} from './estadisticas';
import { formatoDuracion, formatoFecha, soloFecha } from './fechas';
import type { Adherencia } from './profilaxis';
import * as t from './textos';
import type { Crisis, FechaHoraLocal, Perfil, Periodo } from './tipos';

export interface FilaDetalle {
  id: string;
  numero: number;
  inicio: string;
  fin: string;
  duracion: string;
  zonas: string;
  gravedad: string;
  prodromos: string;
  desencadenantes: string;
  medicacion: string;
  atencion: string;
  diasPerdidos: string;
  notas: string;
  evolucion: string;
  viaAerea: boolean;
}

export interface DatosInforme {
  paciente: Perfil;
  periodo: Periodo;
  periodoTexto: string;
  generadoEn: string;
  resumen: { etiqueta: string; valor: string }[];
  porMes: { mes: string; cantidad: number }[];
  zonas: Conteo[];
  desencadenantes: Conteo[];
  prodromos: Conteo[];
  medicacion: UsoMedicamento[];
  detalle: FilaDetalle[];
  avisos: string[];
}

const dec = (n: number) => n.toFixed(1).replace('.', ',');

export function construirInforme(
  todas: Crisis[],
  perfil: Perfil,
  periodo: Periodo,
  generadoEn: FechaHoraLocal,
  /** Adherencia al tratamiento preventivo en el período, si hay un plan cargado */
  adherenciaProfilaxis?: Adherencia,
): DatosInforme {
  // Orden cronológico: es como lo lee el médico.
  const lista = todas
    .filter((c) => !c.eliminadoEn && enPeriodo(c, periodo))
    .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
  const r = resumen(lista, periodo);
  const dias = diasDelPeriodo(todas.filter((c) => !c.eliminadoEn), periodo, soloFecha(generadoEn));

  const filas: { etiqueta: string; valor: string }[] = [
    { etiqueta: 'Crisis registradas', valor: String(r.total) },
    { etiqueta: 'Promedio por mes', valor: dec(r.crisisPorMes) },
    {
      etiqueta: 'Gravedad',
      valor:
        `Leves: ${r.porGravedad.leve}, moderadas: ${r.porGravedad.moderada}, graves: ${r.porGravedad.grave}` +
        (r.sinGravedad ? `, sin dato: ${r.sinGravedad}` : ''),
    },
    { etiqueta: 'Con compromiso de lengua o garganta/laringe', valor: String(r.viaAerea) },
    {
      etiqueta: 'Duración promedio',
      valor: r.duracionMediaHoras === null ? t.SIN_DATO : formatoDuracion(r.duracionMediaHoras),
    },
    {
      etiqueta: 'Duración máxima',
      valor: r.duracionMaximaHoras === null ? t.SIN_DATO : formatoDuracion(r.duracionMaximaHoras),
    },
    { etiqueta: 'Crisis con medicación de rescate', valor: `${r.tratadas} (sin medicación: ${r.noTratadas})` },
    {
      etiqueta: 'Tiempo promedio hasta la primera dosis',
      valor: r.horasHastaTratamiento === null ? t.SIN_DATO : formatoDuracion(r.horasHastaTratamiento),
    },
    {
      etiqueta: 'Atención médica',
      valor: `Consultas: ${r.porAtencion.consulta}, emergencias: ${r.porAtencion.emergencia}, internaciones: ${r.porAtencion.internacion}, sin atención: ${r.porAtencion.ninguna}`,
    },
    { etiqueta: 'Días sin poder trabajar o estudiar', valor: String(r.diasPerdidos).replace('.', ',') },
  ];
  if (dias.dias > 0) {
    // Después del promedio por mes: los dos hablan de frecuencia.
    filas.splice(
      2,
      0,
      { etiqueta: 'Días con crisis', valor: `${dias.conCrisis} de ${dias.dias} (${dec((dias.conCrisis / dias.dias) * 100)} %)` },
      { etiqueta: 'Mayor racha sin crisis', valor: `${dias.rachaLibre} ${dias.rachaLibre === 1 ? 'día' : 'días'}` },
    );
  }
  if (adherenciaProfilaxis && adherenciaProfilaxis.porcentaje !== null) {
    filas.push({
      etiqueta: 'Tomas del tratamiento preventivo registradas',
      valor: `${adherenciaProfilaxis.tomadas} de ${adherenciaProfilaxis.esperadas} (${adherenciaProfilaxis.porcentaje} %)`,
    });
  }

  const avisos: string[] = [];
  if (r.enCurso) avisos.push(`${r.enCurso} crisis seguía(n) en curso al generar el informe.`);
  const incompletas = lista.filter(estaIncompleta).length;
  if (incompletas)
    avisos.push(`${incompletas} registro(s) tienen campos sin completar; figuran como "${t.SIN_DATO}".`);
  if (lista.some((c) => c.sinHora))
    avisos.push('En algunas crisis solo se registró el día; su duración es aproximada.');

  return {
    paciente: perfil,
    periodo,
    periodoTexto: `${formatoFecha(periodo.desde)} al ${formatoFecha(periodo.hasta)}`,
    generadoEn: formatoFecha(generadoEn),
    resumen: filas,
    porMes: crisisPorMes(lista, periodo),
    zonas: frecuenciaZonas(lista),
    desencadenantes: frecuenciaDesencadenantes(lista),
    prodromos: frecuenciaProdromos(lista),
    medicacion: usoMedicacion(lista),
    detalle: lista.map((c, i) => ({
      id: c.id,
      numero: i + 1,
      inicio: t.textoInicio(c),
      fin: t.textoFin(c),
      duracion: t.textoDuracion(c),
      zonas: t.textoZonas(c),
      gravedad: t.textoGravedad(c),
      prodromos: t.textoProdromos(c),
      desencadenantes: t.textoDesencadenantes(c),
      medicacion: t.textoMedicacion(c),
      atencion: t.textoAtencion(c),
      diasPerdidos: t.textoDiasPerdidos(c),
      notas: c.notas.trim(),
      evolucion: t.textoEvolucion(c),
      viaAerea: afectaViaAerea(c),
    })),
    avisos,
  };
}
