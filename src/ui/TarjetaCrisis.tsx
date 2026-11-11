import { Link } from 'react-router-dom';
import { afectaViaAerea, estaIncompleta } from '../domain/crisis';
import { textoDuracion, textoInicio, textoZonas } from '../domain/textos';
import type { Crisis } from '../domain/tipos';
import { Insignia, InsigniaGravedad } from './componentes';

/** Resumen de una crisis en una línea de lista; tocarla abre el detalle. */
export function TarjetaCrisis({ crisis: c }: { crisis: Crisis }) {
  return (
    <Link to={`/crisis/${c.id}`} className="tarjeta block active:bg-slate-50">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{textoInicio(c)}</span>
        <span className="text-sm text-slate-600">{textoDuracion(c)}</span>
      </div>
      <p className="mt-1 text-slate-700">{textoZonas(c) === 'Sin dato' ? 'Sin zonas cargadas' : textoZonas(c)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <InsigniaGravedad gravedad={c.gravedad} />
        {afectaViaAerea(c) && <Insignia className="bg-red-100 text-red-800">Vía aérea</Insignia>}
        {c.fin === null && <Insignia className="bg-teal-100 text-teal-900">En curso</Insignia>}
        {estaIncompleta(c) && <Insignia className="bg-sky-100 text-sky-900">Por completar</Insignia>}
      </div>
    </Link>
  );
}
