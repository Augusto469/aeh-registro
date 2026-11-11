import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearCrisis } from '../domain/crisis';
import { parsearRespaldo } from '../domain/respaldo';
import { db } from './db';
import {
  eliminarCrisis,
  exportarRespaldo,
  guardarCrisis,
  importarRespaldo,
  listarCrisis,
  listarMedicamentos,
  obtenerCrisis,
  obtenerUltimoRespaldo,
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
    const texto = JSON.stringify(await exportarRespaldo(false));
    expect(await obtenerUltimoRespaldo()).toBeTruthy();

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
});
