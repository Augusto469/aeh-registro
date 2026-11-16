import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearCrisis } from '../domain/crisis';
import { crearPlan } from '../domain/profilaxis';
import { parsearRespaldo } from '../domain/respaldo';
import { db } from './db';
import {
  agregarMedio,
  eliminarBorrador,
  eliminarCrisis,
  eliminarPlan,
  exportarRespaldo,
  guardarBorrador,
  guardarCrisis,
  guardarMedicamento,
  guardarPlan,
  importarRespaldo,
  limpiarMediosHuerfanos,
  listarCrisis,
  listarMedicamentos,
  listarMedios,
  listarPlanes,
  listarTomas,
  marcarToma,
  obtenerBorrador,
  obtenerCrisis,
  obtenerUltimoRespaldo,
  registrarRespaldoHecho,
  terminarPlan,
} from './repo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('repositorio', () => {
  it('carga la lista inicial de medicamentos', async () => {
    const nombres = (await listarMedicamentos()).map((m) => m.nombre);
    expect(nombres).toContain('Ácido tranexámico');
    expect(nombres).toContain('Icatibant');
  });

  it('guarda, lista por fecha descendente y elimina de forma lógica', async () => {
    await guardarCrisis(crearCrisis({ id: 'a', inicio: '2026-01-01T10:00' }));
    await guardarCrisis(crearCrisis({ id: 'b', inicio: '2026-02-01T10:00' }));
    expect((await listarCrisis()).map((c) => c.id)).toEqual(['b', 'a']);

    await eliminarCrisis('a');
    expect((await listarCrisis()).map((c) => c.id)).toEqual(['b']);
    expect(await obtenerCrisis('a')).toBeUndefined();
    // La fila sigue existiendo con la marca de borrado
    expect((await db.crisis.get('a'))?.eliminadoEn).toBeTruthy();
  });

  it('exporta y vuelve a importar en una base vacía', async () => {
    await guardarCrisis(crearCrisis({ id: 'a', inicio: '2026-01-01T10:00', zonas: ['cara'], notas: 'ñandú' }));
    const respaldo = await exportarRespaldo(false);
    const texto = JSON.stringify(respaldo);
    // Armar el respaldo no alcanza: la fecha se anota recién cuando el archivo salió de la app.
    expect(await obtenerUltimoRespaldo()).toBeNull();
    await registrarRespaldoHecho(respaldo.exportadoEn);
    expect(await obtenerUltimoRespaldo()).toBe(respaldo.exportadoEn);

    await db.delete();
    await db.open();
    const res = await importarRespaldo(parsearRespaldo(texto));
    expect(res).toMatchObject({ nuevas: 1, actualizadas: 0 });
    expect((await obtenerCrisis('a'))?.notas).toBe('ñandú');
    // Importar dos veces no duplica nada
    expect(await importarRespaldo(parsearRespaldo(texto))).toMatchObject({ nuevas: 0, sinCambios: 1 });
    expect(await listarCrisis()).toHaveLength(1);
    expect(await listarMedicamentos()).toHaveLength(5);
  });

  it('importar no pisa un medicamento renombrado acá ni duplica nombres', async () => {
    const texto = JSON.stringify(await exportarRespaldo(false));
    const [primero] = await listarMedicamentos();
    await guardarMedicamento({ ...primero, nombre: 'Nombre nuevo' });

    await importarRespaldo(parsearRespaldo(texto));
    const lista = await listarMedicamentos();
    expect(lista).toHaveLength(5);
    expect(lista.find((m) => m.id === primero.id)?.nombre).toBe('Nombre nuevo');
  });

  it('guarda, recupera y elimina el borrador de una crisis sin mezclarlo con las guardadas', async () => {
    const c = crearCrisis({ id: 'x', inicio: '2026-03-01T10:00', notas: 'a medio cargar' });
    await guardarBorrador('nueva', c);
    expect((await obtenerBorrador('nueva'))?.notas).toBe('a medio cargar');
    expect(await obtenerBorrador('otra')).toBeUndefined();
    // Un borrador no es una crisis: no aparece en la lista ni viaja en el respaldo.
    expect(await listarCrisis()).toHaveLength(0);
    expect((await exportarRespaldo(false)).crisis).toHaveLength(0);

    await eliminarBorrador('nueva');
    expect(await obtenerBorrador('nueva')).toBeUndefined();
  });

  it('la limpieza de archivos huérfanos conserva los de un borrador pendiente', async () => {
    const medio = (id: string, crisisId: string) => ({
      id,
      crisisId,
      tipo: 'foto' as const,
      blob: new Blob(['x']),
      mime: 'image/jpeg',
      nombre: 'foto.jpg',
      creadoEn: '2026-03-01T10:00:00.000Z',
    });
    await guardarCrisis(crearCrisis({ id: 'guardada', inicio: '2026-03-01T10:00' }));
    await guardarBorrador('nueva', crearCrisis({ id: 'en-borrador', inicio: '2026-03-02T10:00' }));
    await agregarMedio(medio('m1', 'guardada'));
    await agregarMedio(medio('m2', 'en-borrador'));
    await agregarMedio(medio('m3', 'abandonada'));

    await limpiarMediosHuerfanos();
    expect(await listarMedios('guardada')).toHaveLength(1);
    expect(await listarMedios('en-borrador')).toHaveLength(1);
    expect(await listarMedios('abandonada')).toHaveLength(0);
  });

  it('descuenta stock una sola vez por cada dosis nueva al guardar una crisis', async () => {
    const [med] = await listarMedicamentos();
    await guardarMedicamento({ ...med, stock: 3 });
    const dosis = (id: string) => ({ id, medicamento: med.nombre, dosis: '', hora: null, respuesta: null });
    const stock = async () => (await listarMedicamentos()).find((m) => m.id === med.id)?.stock;

    const c = crearCrisis({ id: 'a', inicio: '2026-01-01T10:00', tratamientos: [dosis('t1')] });
    await guardarCrisis(c);
    expect(await stock()).toBe(2);
    // Volver a guardar la misma crisis no descuenta de nuevo; agregar otra dosis sí.
    await guardarCrisis({ ...c, notas: 'editada' });
    expect(await stock()).toBe(2);
    await guardarCrisis({ ...c, tratamientos: [dosis('t1'), dosis('t2'), dosis('t3'), dosis('t4')] });
    expect(await stock()).toBe(0); // nunca baja de cero
  });

  it('no toca el stock de un medicamento del que no se lleva la cuenta', async () => {
    const [med] = await listarMedicamentos();
    await guardarCrisis(
      crearCrisis({ id: 'a', inicio: '2026-01-01T10:00', tratamientos: [{ id: 't1', medicamento: med.nombre, dosis: '', hora: null, respuesta: null }] }),
    );
    expect((await listarMedicamentos()).find((m) => m.id === med.id)?.stock).toBeUndefined();
  });

  it('guarda planes de tratamiento preventivo y marca tomas sin duplicarlas', async () => {
    const plan = crearPlan({ id: 'p', medicamento: 'Ácido tranexámico', desde: '2026-03-01', horarios: ['08:00', '20:00'] });
    await guardarPlan(plan);
    await marcarToma('p', '2026-03-01', '08:00', true);
    await marcarToma('p', '2026-03-01', '08:00', true);
    await marcarToma('p', '2026-03-01', '20:00', true);
    expect(await listarTomas()).toHaveLength(2);
    await marcarToma('p', '2026-03-01', '20:00', false);
    expect((await listarTomas()).map((t) => t.horario)).toEqual(['08:00']);

    await terminarPlan('p', '2026-03-10');
    expect((await listarPlanes())[0].hasta).toBe('2026-03-10');

    await eliminarPlan('p');
    expect(await listarPlanes()).toHaveLength(0);
    expect(await listarTomas()).toHaveLength(0);
  });

  it('el respaldo lleva el tratamiento preventivo, el stock y la evolución, y acepta respaldos anteriores', async () => {
    const [med] = await listarMedicamentos();
    await guardarMedicamento({ ...med, stock: 4, stockMinimo: 1, vencimiento: '2027-05-31' });
    await guardarCrisis(
      crearCrisis({ id: 'a', inicio: '2026-01-01T10:00', evolucion: [{ id: 'e', hora: '2026-01-01T14:00', gravedad: 'grave', nota: 'peor' }] }),
    );
    await guardarPlan(crearPlan({ id: 'p', medicamento: 'Ácido tranexámico', desde: '2026-03-01' }));
    await marcarToma('p', '2026-03-01', '08:00', true);
    const respaldo = await exportarRespaldo(false);
    const texto = JSON.stringify(respaldo);

    await db.delete();
    await db.open();
    const res = await importarRespaldo(parsearRespaldo(texto));
    expect(res).toMatchObject({ nuevas: 1, planes: 1 });
    expect((await obtenerCrisis('a'))?.evolucion?.[0].nota).toBe('peor');
    expect(await listarPlanes()).toHaveLength(1);
    expect(await listarTomas()).toHaveLength(1);
    // Importar de nuevo no duplica.
    expect(await importarRespaldo(parsearRespaldo(texto))).toMatchObject({ nuevas: 0, planes: 0 });
    expect(await listarTomas()).toHaveLength(1);

    // Un respaldo de la versión anterior de la app no trae planes, tomas ni evolución.
    const { planes: _p, tomas: _t, ...viejo } = respaldo;
    const antiguo = { ...viejo, crisis: viejo.crisis.map(({ evolucion: _e, ...c }) => c) };
    expect(() => parsearRespaldo(JSON.stringify(antiguo))).not.toThrow();
  });
});
