/**
 * Esquema de IndexedDB (Dexie). Solo se indexa lo que se consulta; el resto de
 * los campos se guarda igual. Para cambiar el esquema se agrega `version(2)`
 * con su `upgrade`, nunca se edita una versión ya publicada.
 */
import Dexie, { type Table } from 'dexie';
import { nuevoId } from '../domain/crisis';
import { MEDICAMENTOS_INICIALES, type Crisis, type Medicamento, type Medio } from '../domain/tipos';

export interface Ajuste {
  clave: string;
  valor: unknown;
}

export class BaseAEH extends Dexie {
  crisis!: Table<Crisis, string>;
  medios!: Table<Medio, string>;
  medicamentos!: Table<Medicamento, string>;
  ajustes!: Table<Ajuste, string>;

  constructor(nombre = 'aeh-registro') {
    super(nombre);
    this.version(1).stores({
      crisis: 'id, inicio, actualizadoEn',
      // Fotos y videos van aparte para que listar el historial no cargue archivos pesados.
      medios: 'id, crisisId',
      medicamentos: 'id',
      ajustes: 'clave',
    });
    // Solo corre la primera vez que se crea la base.
    this.on('populate', () => {
      this.medicamentos.bulkAdd(MEDICAMENTOS_INICIALES.map((m) => ({ id: nuevoId(), ...m })));
    });
  }
}

export const db = new BaseAEH();
