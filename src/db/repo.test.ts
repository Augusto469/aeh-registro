import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearCrisis } from '../domain/crisis';
import { parsearRespaldo } from '../domain/respaldo';
import { db } from './db';
import {
  agregarMedio,
  eliminarBorrador,
  eliminarCrisis,
  exportarRespaldo,
  guardarBorrador,
  guardarCrisis,
  guardarMedicamento,
  importarRespaldo,
  limpiarMediosHuerfanos,
  listarCrisis,
  listarMedicamentos,
  listarMedios,
  obtenerBorrador,
  obtenerCrisis,
  obtenerUltimoRespaldo,
  registrarRespaldoHecho,
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
});
