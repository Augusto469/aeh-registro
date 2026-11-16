import { describe, expect, it } from 'vitest';
import { avisosMedicacion, descuentosDeStock } from './medicacion';
import { adherencia, crearPlan, idToma, textoFrecuencia, tocaEnFecha, tomasDelDia, validarPlan } from './profilaxis';
import type { Medicamento, Toma } from './tipos';

const toma = (planId: string, fecha: string, horario: string): Toma => ({
  id: idToma(planId, fecha, horario),
  planId,
  fecha,
  horario,
  tomadaEn: `${fecha}T12:00:00.000Z`,
});

describe('tratamiento preventivo', () => {
  const diario = crearPlan({ id: 'd', medicamento: 'Ácido tranexámico', desde: '2026-03-01', horarios: ['08:00', '20:00'] });
  const semanal = crearPlan({ id: 's', medicamento: 'Lanadelumab', desde: '2026-03-02', horarios: ['09:00'], cadaDias: 7 });

  it('sabe qué días toca según la frecuencia y las fechas del plan', () => {
    expect(tocaEnFecha(diario, '2026-02-28')).toBe(false); // antes de empezar
    expect(tocaEnFecha(diario, '2026-03-01')).toBe(true);
    expect(tocaEnFecha(semanal, '2026-03-02')).toBe(true);
    expect(tocaEnFecha(semanal, '2026-03-08')).toBe(false);
    expect(tocaEnFecha(semanal, '2026-03-09')).toBe(true);
    expect(tocaEnFecha({ ...diario, hasta: '2026-03-10' }, '2026-03-11')).toBe(false); // terminado
    expect(tocaEnFecha({ ...diario, eliminadoEn: '2026-03-05T00:00:00.000Z' }, '2026-03-02')).toBe(false);
  });

  it('lista las tomas del día en orden y marca las atrasadas', () => {
    const lista = tomasDelDia([semanal, diario], [toma('d', '2026-03-09', '08:00')], '2026-03-09', '2026-03-09T10:00');
    expect(lista.map((t) => [t.horario, t.plan.id, t.tomada, t.atrasada])).toEqual([
      ['08:00', 'd', true, false],
      ['09:00', 's', false, true],
      ['20:00', 'd', false, false],
    ]);
  });

  it('calcula la adherencia solo con las tomas que ya debían haberse tomado', () => {
    // Del 1 al 3 de marzo, a las 10:00 del día 3: tocaban 08:00 y 20:00 los días 1 y 2, y 08:00 el día 3.
    const tomas = [toma('d', '2026-03-01', '08:00'), toma('d', '2026-03-01', '20:00'), toma('d', '2026-03-02', '08:00')];
    const a = adherencia([diario], tomas, { desde: '2026-03-01', hasta: '2026-03-31' }, '2026-03-03T10:00');
    expect(a).toEqual({ esperadas: 5, tomadas: 3, porcentaje: 60 });
  });

  it('una toma adelantada cuenta y un período sin tomas esperadas no da porcentaje', () => {
    const adelantada = adherencia([diario], [toma('d', '2026-03-01', '20:00')], { desde: '2026-03-01', hasta: '2026-03-01' }, '2026-03-01T09:00');
    expect(adelantada).toEqual({ esperadas: 2, tomadas: 1, porcentaje: 50 });
    expect(adherencia([diario], [], { desde: '2026-01-01', hasta: '2026-01-31' }, '2026-03-03T10:00').porcentaje).toBeNull();
    expect(adherencia([], [], { desde: '2026-03-01', hasta: '2026-03-31' }, '2026-03-03T10:00').porcentaje).toBeNull();
  });

  it('valida el plan', () => {
    expect(validarPlan(diario)).toBeNull();
    expect(validarPlan({ ...diario, medicamento: ' ' })).toMatch(/medicamento/);
    expect(validarPlan({ ...diario, horarios: [] })).toMatch(/horario/);
    expect(validarPlan({ ...diario, horarios: ['25:00'] })).toMatch(/válida/);
    expect(validarPlan({ ...diario, horarios: ['08:00', '08:00'] })).toMatch(/repetido/);
    expect(validarPlan({ ...diario, cadaDias: 0 })).toMatch(/frecuencia/);
    expect(validarPlan({ ...diario, hasta: '2026-02-01' })).toMatch(/anterior/);
  });

  it('describe la frecuencia', () => {
    expect([1, 2, 7, 14].map(textoFrecuencia)).toEqual(['todos los días', 'día por medio', 'una vez por semana', 'cada 14 días']);
  });
});

describe('stock y vencimiento', () => {
  const med = (d: Partial<Medicamento>): Medicamento => ({ id: 'm', nombre: 'Icatibant', dosisHabitual: '', ...d });

  it('no avisa si no se lleva stock ni vencimiento', () => {
    expect(avisosMedicacion([med({})], '2026-03-10')).toEqual([]);
    expect(avisosMedicacion([med({ stock: 5, stockMinimo: 1, vencimiento: '2027-01-01' })], '2026-03-10')).toEqual([]);
  });

  it('avisa por vencimiento y por stock, con lo urgente primero', () => {
    const avisos = avisosMedicacion(
      [med({ id: 'a', stock: 1, stockMinimo: 1, vencimiento: '2026-03-25' }), med({ id: 'b', nombre: 'Otro', stock: 0, vencimiento: '2026-03-01' })],
      '2026-03-10',
    );
    expect(avisos.map((a) => [a.medicamentoId, a.tipo])).toEqual([
      ['b', 'vencido'],
      ['b', 'sinStock'],
      ['a', 'porVencer'],
      ['a', 'pocoStock'],
    ]);
    expect(avisos[2].texto).toContain('en 15 días');
    expect(avisos[3].texto).toContain('te queda 1 unidad');
  });

  it('descuenta una unidad por dosis nueva, solo de los medicamentos con stock', () => {
    const lista = [med({ id: 'a', stock: 3 }), med({ id: 'b', nombre: 'Sin control' })];
    const d = descuentosDeStock([{ medicamento: ' icatibant ' }, { medicamento: 'Icatibant' }, { medicamento: 'Sin control' }, { medicamento: 'Desconocido' }], lista);
    expect([...d]).toEqual([['a', 2]]);
  });
});
