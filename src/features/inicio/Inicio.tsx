import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { guardarCrisis, listarCrisis, obtenerBorrador, obtenerUltimoRespaldo } from '../../db/repo';
import { estaIncompleta } from '../../domain/crisis';
import { ahoraLocal, soloFecha } from '../../domain/fechas';
import { textoInicio, textoZonas } from '../../domain/textos';
import type { Crisis } from '../../domain/tipos';
import { Pagina } from '../../ui/componentes';
import { TarjetaCrisis } from '../../ui/TarjetaCrisis';

const DIAS_AVISO_RESPALDO = 30;

export function Inicio() {
  // useLiveQuery vuelve a ejecutar la consulta cada vez que cambia la base.
  const crisis = useLiveQuery(listarCrisis, []);
  const ultimoRespaldo = useLiveQuery(obtenerUltimoRespaldo, []);
  const borradorNueva = useLiveQuery(() => obtenerBorrador('nueva'), []);
  if (!crisis) return null;

  const abiertas = crisis.filter((c) => c.fin === null);
  const pendientes = crisis.filter((c) => c.fin !== null && estaIncompleta(c));
  const diasSinRespaldo = ultimoRespaldo ? (Date.now() - new Date(ultimoRespaldo).getTime()) / 86_400_000 : Infinity;

  const cerrar = (c: Crisis) => {
    const ahora = ahoraLocal();
    const fin = c.sinHora ? `${soloFecha(ahora)}T00:00` : ahora;
    // Si el inicio quedó cargado en el futuro, el fin no puede ser anterior.
    void guardarCrisis({ ...c, fin: fin < c.inicio ? c.inicio : fin });
  };

  return (
    <Pagina titulo="Mis crisis de AEH">
      {abiertas.map((c) => (
        <div key={c.id} className="rounded-2xl border-2 border-teal-700 bg-teal-50 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Crisis en curso</p>
          <p className="mt-1 text-lg font-semibold">Desde {textoInicio(c)}</p>
          <p className="text-slate-700">{textoZonas(c)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn-primario" onClick={() => cerrar(c)}>
              Terminó ahora
            </button>
            <Link className="btn" to={`/crisis/${c.id}`}>
              Completar datos
            </Link>
          </div>
        </div>
      ))}

      <Link to="/rapida" className="btn-primario min-h-[72px] w-full text-xl">
        + Registrar crisis
      </Link>
      <Link to="/crisis/nueva" className="btn w-full">
        {borradorNueva ? 'Seguir cargando la crisis pasada' : 'Cargar una crisis pasada'}
      </Link>
      {borradorNueva && <p className="text-center text-sm text-amber-800">Tenés una crisis a medio cargar, sin guardar.</p>}

      {crisis.length > 0 && diasSinRespaldo > DIAS_AVISO_RESPALDO && (
        <Link to="/ajustes" className="block rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <strong>{ultimoRespaldo ? `Hace ${Math.floor(diasSinRespaldo)} días que no hacés un respaldo.` : 'Todavía no hiciste ningún respaldo.'}</strong>{' '}
          Los datos están solo en este dispositivo. Tocá acá para exportarlos.
        </Link>
      )}

      {pendientes.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Por completar</h2>
          <div className="space-y-2">
            {pendientes.map((c) => (
              <TarjetaCrisis key={c.id} crisis={c} />
            ))}
          </div>
        </section>
      )}

      {crisis.length === 0 && (
        <p className="tarjeta text-slate-600">
          Todavía no hay crisis registradas. Con el botón de arriba guardás una en pocos toques y la completás después.
        </p>
      )}

      <p className="text-center text-sm text-slate-500">
        Esta app solo registra datos. No da recomendaciones médicas ni reemplaza a tu médico.
      </p>
    </Pagina>
  );
}
