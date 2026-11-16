import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { crearCrisis } from '../domain/crisis';
import { BaseAEH } from './db';

describe('actualización de la base de datos', () => {
  it('abrir una base de la versión 1 con la app nueva conserva los datos y agrega las tablas nuevas', async () => {
    const nombre = 'aeh-prueba-migracion';
    await Dexie.delete(nombre);

    // Así quedó la base en los celulares que instalaron la primera versión de la app.
    const vieja = new Dexie(nombre);
    vieja.version(1).stores({
      crisis: 'id, inicio, actualizadoEn',
      medios: 'id, crisisId',
      medicamentos: 'id',
      ajustes: 'clave',
    });
    await vieja.table('crisis').put(crearCrisis({ id: 'a', inicio: '2026-01-01T10:00', notas: 'de antes' }));
    await vieja.table('medicamentos').put({ id: 'm', nombre: 'Icatibant', dosisHabitual: '30 mg' });
    await vieja.table('ajustes').put({ clave: 'ultimoRespaldo', valor: '2026-01-02T00:00:00.000Z' });
    vieja.close();

    const nueva = new BaseAEH(nombre);
    await nueva.open();
    expect((await nueva.crisis.get('a'))?.notas).toBe('de antes');
    expect(await nueva.medicamentos.count()).toBe(1); // no se vuelve a cargar la lista inicial
    expect((await nueva.ajustes.get('ultimoRespaldo'))?.valor).toBe('2026-01-02T00:00:00.000Z');
    expect(await nueva.planes.count()).toBe(0);
    expect(await nueva.tomas.count()).toBe(0);
    nueva.close();
    await Dexie.delete(nombre);
  });
});
