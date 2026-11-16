import { describe, expect, it } from 'vitest';
import {
  activaEnDia,
  camposPendientes,
  crearCrisis,
  duracionHoras,
  enPeriodo,
  filtrarCrisis,
  ordenarPorInicio,
  validarCrisis,
} from './crisis';
import { crisisACsv } from './csv';
import { formatoDuracion, formatoFecha, mesesEntre, nombreMes, sumarDias, sumarMeses } from './fechas';
import { crearRespaldo, fusionarCrisis, parsearRespaldo } from './respaldo';
import type { Crisis } from './tipos';

const base = (d: Partial<Crisis>): Crisis =>
  crearCrisis({ creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z', ...d });

describe('fechas', () => {
  it('lista los meses entre dos fechas cruzando de año', () => {
    expect(mesesEntre('2025-11-20', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('formatea fechas y meses en español', () => {
    expect(formatoFecha('2026-03-05T14:30')).toBe('05/03/2026 14:30');
    expect(formatoFecha('2026-03-05T00:00', true)).toBe('05/03/2026');
    expect(nombreMes('2026-09')).toBe('set 2026');
  });
  it('formatea duraciones', () => {
    expect(formatoDuracion(0.5)).toBe('30 min');
    expect(formatoDuracion(20)).toBe('20 h');
    expect(formatoDuracion(51)).toBe('2 d 3 h');
    expect(formatoDuracion(72)).toBe('3 d');
  });
  it('redondea la duración antes de separar días y horas', () => {
    expect(formatoDuracion(71.6)).toBe('3 d');
    expect(formatoDuracion(47.6)).toBe('2 d');
    expect(formatoDuracion(0.999)).toBe('1 h');
    expect(formatoDuracion(0.001)).toBe('1 min');
  });
  it('suma meses sin desbordar al mes siguiente', () => {
    expect(sumarMeses('2026-05-31', -3)).toBe('2026-02-28');
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2024-03-31', -1)).toBe('2024-02-29');
    expect(sumarMeses('2026-01-15', -2)).toBe('2025-11-15');
    expect(sumarMeses('2026-11-16', 6)).toBe('2027-05-16');
  });
  it('suma días cruzando de mes', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01');
  });
});

describe('crisis', () => {
  it('una crisis rápida queda en curso y con campos pendientes', () => {
    const c = crearCrisis({ zonas: ['cara'], gravedad: 'leve' });
    expect(c.fin).toBeNull();
    expect(camposPendientes(c)).toEqual(['síntomas previos', 'desencadenante', 'medicación', 'atención médica', 'impacto']);
  });
  it('"ninguno" cuenta como cargado, a diferencia de "sin dato"', () => {
    const c = base({ zonas: ['cara'], gravedad: 'leve', prodromos: [], desencadenantes: ['desconocido'], tratamientos: [], atencion: 'ninguna', diasPerdidos: 0 });
    expect(camposPendientes(c)).toEqual([]);
  });
  it('calcula la duración con hora y solo con día', () => {
    expect(duracionHoras(base({ inicio: '2026-03-01T10:00', fin: '2026-03-02T16:00' }))).toBe(30);
    expect(duracionHoras(base({ inicio: '2026-03-03T00:00', fin: '2026-03-05T00:00', sinHora: true }))).toBe(72);
    expect(duracionHoras(base({ inicio: '2026-03-01T10:00' }))).toBeNull();
  });
  it('rechaza un fin anterior al inicio', () => {
    expect(validarCrisis(base({ inicio: '2026-03-02T10:00', fin: '2026-03-01T10:00' }))).toMatch(/anterior/);
    expect(validarCrisis(base({ inicio: '2026-03-02T10:00', fin: '2026-03-02T10:00' }))).toBeNull();
  });
  it('asigna la crisis al período por su fecha de inicio', () => {
    const c = base({ inicio: '2026-01-31T23:00', fin: '2026-02-03T08:00' });
    expect(enPeriodo(c, { desde: '2026-01-01', hasta: '2026-01-31' })).toBe(true);
    expect(enPeriodo(c, { desde: '2026-02-01', hasta: '2026-02-28' })).toBe(false);
  });
  it('marca en el calendario todos los días de la crisis', () => {
    const c = base({ inicio: '2026-01-31T23:00', fin: '2026-02-02T08:00' });
    expect(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02', '2026-02-03'].map((d) => activaEnDia(c, d, '2026-06-01')))
      .toEqual([false, true, true, true, false]);
    const abierta = base({ inicio: '2026-05-30T10:00' });
    expect(activaEnDia(abierta, '2026-06-01', '2026-06-01')).toBe(true);
    expect(activaEnDia(abierta, '2026-06-02', '2026-06-01')).toBe(false);
  });
  it('filtra por zona, gravedad, fechas y medicación', () => {
    const a = base({ inicio: '2026-01-10T10:00', zonas: ['cara'], gravedad: 'leve', tratamientos: [] });
    const b = base({ inicio: '2026-02-10T10:00', zonas: ['abdomen', 'cara'], gravedad: 'grave',
      tratamientos: [{ id: 't', medicamento: 'X', dosis: '', hora: null, respuesta: null }] });
    const c = base({ inicio: '2026-03-10T10:00', zonas: ['abdomen'] });
    const todas = [a, b, c];
    expect(filtrarCrisis(todas, { zona: 'cara' })).toEqual([a, b]);
    expect(filtrarCrisis(todas, { gravedad: 'grave' })).toEqual([b]);
    expect(filtrarCrisis(todas, { desde: '2026-02-01', hasta: '2026-02-28' })).toEqual([b]);
    expect(filtrarCrisis(todas, { medicacion: 'con' })).toEqual([b]);
    expect(filtrarCrisis(todas, { medicacion: 'sin' })).toEqual([a]);
    expect(filtrarCrisis(todas, { soloIncompletas: true })).toHaveLength(3);
    expect(ordenarPorInicio(todas).map((x) => x.inicio.slice(5, 7))).toEqual(['03', '02', '01']);
  });
});

describe('csv', () => {
  it('escapa comillas, saltos de línea y punto y coma', () => {
    const csv = crisisACsv([base({ inicio: '2026-01-10T10:00', notas: 'dolor; "fuerte"\nde noche' })]);
    expect(csv.startsWith('﻿inicio;fin;')).toBe(true);
    expect(csv).toContain('"dolor; ""fuerte""\nde noche"');
    expect(csv.trim().split('\r\n')).toHaveLength(2);
  });
});

describe('respaldo', () => {
  const c1 = base({ id: 'a', inicio: '2026-01-10T10:00', zonas: ['cara'] });
  it('lo que se exporta se puede volver a importar igual', () => {
    const r = crearRespaldo({ crisis: [c1], medicamentos: [{ id: 'm', nombre: 'Icatibant', dosisHabitual: '30 mg' }], perfil: null });
    expect(parsearRespaldo(JSON.stringify(r))).toEqual(r);
  });
  it('rechaza archivos que no son de la app', () => {
    expect(() => parsearRespaldo('no es json')).toThrow(/JSON/);
    expect(() => parsearRespaldo('{"app":"otra"}')).toThrow(/respaldo válido/);
    const malo = crearRespaldo({ crisis: [{ ...c1, gravedad: 'extrema' as never }], medicamentos: [], perfil: null });
    expect(() => parsearRespaldo(JSON.stringify(malo))).toThrow(/gravedad/);
    const futuro = { ...crearRespaldo({ crisis: [], medicamentos: [], perfil: null }), version: 99 };
    expect(() => parsearRespaldo(JSON.stringify(futuro))).toThrow(/más nueva/);
  });
  it('al fusionar gana la versión modificada más tarde', () => {
    const local = [c1, base({ id: 'b', actualizadoEn: '2026-05-01T00:00:00.000Z' })];
    const importadas = [
      { ...c1, notas: 'editada', actualizadoEn: '2026-02-01T00:00:00.000Z' },
      base({ id: 'b', notas: 'vieja', actualizadoEn: '2026-04-01T00:00:00.000Z' }),
      base({ id: 'c' }),
    ];
    const f = fusionarCrisis(local, importadas);
    expect(f).toMatchObject({ nuevas: 1, actualizadas: 1, sinCambios: 1 });
    expect(f.aGuardar.map((c) => c.id)).toEqual(['a', 'c']);
  });
});
