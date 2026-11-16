import { describe, expect, it } from 'vitest';
import { crearCrisis } from './crisis';
import {
  crisisPorMes,
  diasDelPeriodo,
  frecuenciaDesencadenantes,
  frecuenciaZonas,
  periodoAnterior,
  resumen,
  usoMedicacion,
} from './estadisticas';
import { construirInforme } from './informe';
import { PERFIL_VACIO, type Crisis, type Tratamiento } from './tipos';

const trat = (d: Partial<Tratamiento>): Tratamiento => ({ id: 't', medicamento: 'Ácido tranexámico', dosis: '1 g', hora: null, respuesta: null, ...d });

/** Juego de datos fijo: 4 crisis entre enero y marzo de 2026. */
const datos: Crisis[] = [
  crearCrisis({
    id: '1', inicio: '2026-01-05T08:00', fin: '2026-01-06T08:00', zonas: ['cara', 'labios'], gravedad: 'moderada',
    prodromos: ['eritema'], desencadenantes: ['estres'], atencion: 'ninguna', diasPerdidos: 1,
    tratamientos: [trat({ hora: '2026-01-05T10:00', respuesta: 'si' }), trat({ hora: '2026-01-05T18:00', respuesta: 'parcial' })],
  }),
  crearCrisis({
    id: '2', inicio: '2026-01-20T22:00', fin: '2026-01-22T22:00', zonas: ['laringe', 'cara'], gravedad: 'grave',
    prodromos: [], desencadenantes: ['estres', 'infeccion'], atencion: 'emergencia', diasPerdidos: 3,
    tratamientos: [trat({ medicamento: 'Icatibant', dosis: '30 mg', hora: '2026-01-21T00:00', respuesta: 'si' })],
  }),
  crearCrisis({
    id: '3', inicio: '2026-03-10T00:00', fin: '2026-03-11T00:00', sinHora: true, zonas: ['abdomen'], gravedad: 'leve',
    prodromos: null, desencadenantes: ['desconocido'], atencion: 'ninguna', diasPerdidos: 0, tratamientos: [],
  }),
  // Registro rápido sin completar y todavía en curso
  crearCrisis({ id: '4', inicio: '2026-03-28T09:00', zonas: ['extremidades'] }),
];
const periodo = { desde: '2026-01-01', hasta: '2026-03-31' };

describe('estadísticas', () => {
  it('cuenta crisis por mes e incluye los meses en cero', () => {
    expect(crisisPorMes(datos, periodo)).toEqual([
      { mes: '2026-01', cantidad: 2 },
      { mes: '2026-02', cantidad: 0 },
      { mes: '2026-03', cantidad: 2 },
    ]);
  });

  it('ordena las zonas de más a menos frecuente', () => {
    const z = frecuenciaZonas(datos);
    expect(z[0]).toEqual({ clave: 'cara', etiqueta: 'Cara', cantidad: 2 });
    expect(z.map((x) => x.cantidad)).toEqual([2, 1, 1, 1, 1]);
  });

  it('no cuenta desencadenantes de crisis sin ese dato', () => {
    expect(frecuenciaDesencadenantes(datos)).toEqual([
      { clave: 'estres', etiqueta: 'Estrés', cantidad: 2 },
      { clave: 'desconocido', etiqueta: 'Desconocido', cantidad: 1 },
      { clave: 'infeccion', etiqueta: 'Infección', cantidad: 1 },
    ]);
  });

  it('resume el uso de medicación por medicamento', () => {
    expect(usoMedicacion(datos)).toEqual([
      { medicamento: 'Ácido tranexámico', usos: 2, crisis: 1, funciono: 1, parcial: 1, noFunciono: 0, sinDato: 0 },
      { medicamento: 'Icatibant', usos: 1, crisis: 1, funciono: 1, parcial: 0, noFunciono: 0, sinDato: 0 },
    ]);
  });

  it('calcula el resumen general', () => {
    const r = resumen(datos, periodo);
    expect(r.total).toBe(4);
    expect(r.enCurso).toBe(1);
    expect(r.porGravedad).toEqual({ leve: 1, moderada: 1, grave: 1 });
    expect(r.sinGravedad).toBe(1);
    expect(r.viaAerea).toBe(1);
    expect(r.tratadas).toBe(2);
    expect(r.noTratadas).toBe(1);
    expect(r.porAtencion).toEqual({ ninguna: 2, consulta: 0, emergencia: 1, internacion: 0 });
    expect(r.diasPerdidos).toBe(4);
    // 24 h + 48 h + 2 días completos (48 h) entre 3 crisis cerradas
    expect(r.duracionMediaHoras).toBe(40);
    expect(r.duracionMaximaHoras).toBe(48);
    // 2 h y 2 h hasta la primera dosis
    expect(r.horasHastaTratamiento).toBe(2);
    // 90 días son 2,96 meses
    expect(r.crisisPorMes).toBeCloseTo(4 / (90 / (365.25 / 12)));
  });

  it('cuenta los días con y sin crisis, incluyendo crisis que empezaron antes del período', () => {
    const lista = [
      crearCrisis({ inicio: '2026-02-27T10:00', fin: '2026-03-02T10:00' }), // toca 1 y 2 de marzo
      crearCrisis({ inicio: '2026-03-10T10:00', fin: '2026-03-10T20:00' }),
      crearCrisis({ inicio: '2026-03-10T22:00', fin: '2026-03-11T08:00' }), // se superpone con la anterior
      crearCrisis({ inicio: '2026-03-29T10:00', fin: null }), // en curso: llega hasta hoy
    ];
    const d = diasDelPeriodo(lista, { desde: '2026-03-01', hasta: '2026-03-31' }, '2026-03-30');
    // Días transcurridos: 1 al 30. Con crisis: 1, 2, 10, 11, 29 y 30.
    expect(d).toEqual({ dias: 30, conCrisis: 6, libres: 24, rachaLibre: 17 });
  });

  it('un período que todavía no empezó no tiene días', () => {
    expect(diasDelPeriodo([], { desde: '2026-05-01', hasta: '2026-05-31' }, '2026-03-30').dias).toBe(0);
  });

  it('calcula el período anterior de igual duración', () => {
    expect(periodoAnterior({ desde: '2026-03-01', hasta: '2026-03-31' })).toEqual({ desde: '2026-01-29', hasta: '2026-02-28' });
  });

  it('con lista vacía no divide por cero', () => {
    const r = resumen([], periodo);
    expect(r.total).toBe(0);
    expect(r.duracionMediaHoras).toBeNull();
    expect(r.crisisPorMes).toBe(0);
  });
});

describe('informe', () => {
  const informe = construirInforme(
    [...datos, crearCrisis({ id: 'fuera', inicio: '2025-12-31T10:00' }), crearCrisis({ id: 'borrada', inicio: '2026-02-01T10:00', eliminadoEn: '2026-02-02T00:00:00.000Z' })],
    { ...PERFIL_VACIO, nombre: 'Paciente de prueba' },
    periodo,
    '2026-04-01T12:00',
  );

  it('incluye solo las crisis del período, en orden cronológico y sin las eliminadas', () => {
    expect(informe.detalle.map((f) => f.id)).toEqual(['1', '2', '3', '4']);
    expect(informe.detalle.map((f) => f.numero)).toEqual([1, 2, 3, 4]);
    expect(informe.periodoTexto).toBe('01/01/2026 al 31/03/2026');
  });

  it('arma el resumen con textos listos para mostrar', () => {
    const valor = (e: string) => informe.resumen.find((f) => f.etiqueta === e)?.valor;
    expect(valor('Crisis registradas')).toBe('4');
    expect(valor('Días con crisis')).toMatch(/ de 90 \(/);
    expect(valor('Mayor racha sin crisis')).toMatch(/días?$/);
    // Sin plan de tratamiento preventivo, esa fila no aparece.
    expect(valor('Tomas del tratamiento preventivo registradas')).toBeUndefined();
    expect(valor('Promedio por mes')).toBe('1,4');
    expect(valor('Gravedad')).toBe('Leves: 1, moderadas: 1, graves: 1, sin dato: 1');
    expect(valor('Con compromiso de lengua o garganta/laringe')).toBe('1');
    expect(valor('Duración promedio')).toBe('40 h');
    expect(valor('Días sin poder trabajar o estudiar')).toBe('4');
  });

  it('describe cada crisis y marca las de vía aérea', () => {
    const [f1, f2, f3, f4] = informe.detalle;
    expect(f1).toMatchObject({ inicio: '05/01/2026 08:00', duracion: '24 h', zonas: 'Cara, Labios', viaAerea: false });
    expect(f1.medicacion).toBe('Ácido tranexámico - 1 g - 05/01/2026 10:00 - Funcionó\nÁcido tranexámico - 1 g - 05/01/2026 18:00 - Parcialmente');
    expect(f2).toMatchObject({ viaAerea: true, prodromos: 'Ninguno', desencadenantes: 'Estrés, Infección' });
    expect(f3).toMatchObject({ inicio: '10/03/2026', duracion: 'aprox. 2 d', medicacion: 'No usó', prodromos: 'Sin dato' });
    expect(f4).toMatchObject({ fin: 'En curso', gravedad: 'Sin dato', medicacion: 'Sin dato' });
  });

  it('avisa sobre crisis en curso, registros incompletos y fechas aproximadas', () => {
    expect(informe.avisos).toHaveLength(3);
  });
});
