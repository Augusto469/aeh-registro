import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  guardarCrisis,
  listarCrisis,
  listarMedicamentos,
  listarPlanes,
  listarTomas,
  marcarToma,
  obtenerBienvenidaVista,
  obtenerBorrador,
  obtenerUltimoRespaldo,
} from '../../db/repo';
import { estaIncompleta } from '../../domain/crisis';
import { ahoraLocal, soloFecha } from '../../domain/fechas';
import { avisosMedicacion } from '../../domain/medicacion';
import { tomasDelDia } from '../../domain/profilaxis';
import { textoInicio, textoZonas } from '../../domain/textos';
import type { Crisis } from '../../domain/tipos';
import { Pagina } from '../../ui/componentes';
import { TarjetaCrisis } from '../../ui/TarjetaCrisis';

const DIAS_AVISO_RESPALDO = 30;

/** Hora actual que se refresca sola cada minuto, para que "atrasada" no quede vieja con la app abierta. */
function useAhora(): string {
  const [ahora, setAhora] = useState(ahoraLocal);
  useEffect(() => {
    const reloj = setInterval(() => setAhora(ahoraLocal()), 60_000);
    return () => clearInterval(reloj);
  }, []);
  return ahora;
}

/** Tomas del tratamiento preventivo que tocan hoy, para marcarlas. */
function TomasDeHoy({ ahora }: { ahora: string }) {
  const planes = useLiveQuery(listarPlanes, []);
  const tomas = useLiveQuery(listarTomas, []);
  if (!planes || !tomas) return null;
  const hoy = soloFecha(ahora);
  const lista = tomasDelDia(planes, tomas, hoy, ahora);
  if (lista.length === 0) return null;
  const hechas = lista.filter((t) => t.tomada).length;

  return (
    <section className="tarjeta">
      <h2 className="mb-1 flex items-baseline justify-between text-lg font-semibold">
        Tratamiento preventivo de hoy
        <span className="text-sm font-normal text-slate-500">
          {hechas} de {lista.length}
        </span>
      </h2>
      <ul className="divide-y divide-slate-100">
        {lista.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {t.horario} · {t.plan.medicamento}
              </p>
              <p className="text-sm text-slate-600">
                {t.plan.dosis}
                {t.atrasada && <span className="text-amber-800">{t.plan.dosis ? ' · ' : ''}Sin marcar</span>}
              </p>
            </div>
            <button
              className={t.tomada ? 'chip chip-activo' : 'chip'}
              aria-pressed={t.tomada}
              onClick={() => void marcarToma(t.plan.id, t.fecha, t.horario, !t.tomada)}
            >
              {t.tomada ? '✓ Tomada' : 'Marcar tomada'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Inicio() {
  // useLiveQuery vuelve a ejecutar la consulta cada vez que cambia la base.
  const crisis = useLiveQuery(listarCrisis, []);
  const ultimoRespaldo = useLiveQuery(obtenerUltimoRespaldo, []);
  const borradorNueva = useLiveQuery(() => obtenerBorrador('nueva'), []);
  const bienvenidaVista = useLiveQuery(obtenerBienvenidaVista, []);
  const medicamentos = useLiveQuery(listarMedicamentos, []);
  const ahora = useAhora();
  if (!crisis || bienvenidaVista === undefined) return null;

  // Primera vez (sin datos y sin haber visto la introducción): se muestra la bienvenida.
  if (!bienvenidaVista && crisis.length === 0 && !borradorNueva) return <Navigate to="/bienvenida" replace />;

  const abiertas = crisis.filter((c) => c.fin === null);
  const pendientes = crisis.filter((c) => c.fin !== null && estaIncompleta(c));
  const diasSinRespaldo = ultimoRespaldo ? (Date.now() - new Date(ultimoRespaldo).getTime()) / 86_400_000 : Infinity;
  const avisos = avisosMedicacion(medicamentos ?? [], soloFecha(ahora));

  const cerrar = (c: Crisis) => {
    const fin = c.sinHora ? `${soloFecha(ahoraLocal())}T00:00` : ahoraLocal();
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

      <TomasDeHoy ahora={ahora} />

      {avisos.length > 0 && (
        <Link to="/medicacion" className="block rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <strong>Revisá tu medicación de rescate</strong>
          <ul className="mt-1 list-disc pl-5">
            {avisos.map((a) => (
              <li key={`${a.medicamentoId}-${a.tipo}`}>{a.texto}</li>
            ))}
          </ul>
        </Link>
      )}

      {crisis.length > 0 && diasSinRespaldo > DIAS_AVISO_RESPALDO && (
        <Link to="/ajustes" className="block rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <strong>{ultimoRespaldo ? `Hace ${Math.floor(diasSinRespaldo)} días que no hacés un respaldo.` : 'Todavía no hiciste ningún respaldo.'}</strong>{' '}
          Los datos están solo en este dispositivo. Tocá acá para hacer uno.
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
