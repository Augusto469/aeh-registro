import { ahoraLocal, soloFecha, sumarDias, sumarMeses } from '../domain/fechas';
import type { Crisis, Periodo } from '../domain/tipos';

export const hoy = () => soloFecha(ahoraLocal());

export function ultimosMeses(n: number): Periodo {
  return { desde: sumarDias(sumarMeses(hoy(), -n), 1), hasta: hoy() };
}

const PREDEFINIDOS = [3, 6, 12];

/**
 * Al tipear el año en una computadora el campo pasa por valores como 0002 o 0202. Con un
 * período así las estadísticas recorren siglos día por día y la pantalla se traba.
 */
const fechaUsable = (v: string) => v.length === 10 && v >= '1900-01-01';

/** Período compartido por Estadísticas e Informe: atajos más fechas a mano. */
export function SelectorPeriodo(p: { periodo: Periodo; onChange: (p: Periodo) => void; crisis: Crisis[] }) {
  const igual = (a: Periodo) => a.desde === p.periodo.desde && a.hasta === p.periodo.hasta;
  // `crisis` viene ordenada de más reciente a más antigua.
  const primera = p.crisis.length ? soloFecha(p.crisis[p.crisis.length - 1].inicio) : hoy();
  const todo: Periodo = { desde: primera, hasta: hoy() };
  const boton = (activo: boolean) => `chip ${activo ? 'chip-activo' : ''}`;
  return (
    <div className="tarjeta space-y-3">
      <div className="flex flex-wrap gap-2">
        {PREDEFINIDOS.map((n) => (
          <button key={n} className={boton(igual(ultimosMeses(n)))} onClick={() => p.onChange(ultimosMeses(n))}>
            {n} meses
          </button>
        ))}
        <button className={boton(igual(todo))} onClick={() => p.onChange(todo)}>
          Todo
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="etiqueta">Desde</span>
          <input className="campo" type="date" value={p.periodo.desde} max={p.periodo.hasta}
            onChange={(e) => fechaUsable(e.target.value) && p.onChange({ ...p.periodo, desde: e.target.value })} />
        </label>
        <label>
          <span className="etiqueta">Hasta</span>
          <input className="campo" type="date" value={p.periodo.hasta} min={p.periodo.desde}
            onChange={(e) => fechaUsable(e.target.value) && p.onChange({ ...p.periodo, hasta: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
