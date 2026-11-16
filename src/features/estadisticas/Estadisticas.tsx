import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { listarCrisis, listarPlanes, listarTomas } from '../../db/repo';
import { enPeriodo } from '../../domain/crisis';
import {
  crisisPorMes,
  diasDelPeriodo,
  frecuenciaDesencadenantes,
  frecuenciaProdromos,
  frecuenciaZonas,
  periodoAnterior,
  resumen,
  usoMedicacion,
} from '../../domain/estadisticas';
import { ahoraLocal, formatoDuracion, nombreMes, soloFecha } from '../../domain/fechas';
import { adherencia } from '../../domain/profilaxis';
import { BarrasH, LeyendaCantidad, Pagina, Seccion, colorCantidad } from '../../ui/componentes';
import { SelectorPeriodo, hoy, ultimosMeses } from '../../ui/SelectorPeriodo';

function Dato({ valor, texto, nota }: { valor: string; texto: string; nota?: string }) {
  return (
    <div className="tarjeta text-center">
      <div className="text-2xl font-bold tabular-nums">{valor}</div>
      <div className="text-sm text-slate-600">{texto}</div>
      {nota && <div className="mt-1 text-xs text-slate-500">{nota}</div>}
    </div>
  );
}

/** "2 menos que en el período anterior". Describe la diferencia, sin calificarla. */
function comparar(actual: number, anterior: number): string {
  const dif = actual - anterior;
  if (dif === 0) return 'igual que en el período anterior';
  return `${Math.abs(dif)} ${dif > 0 ? 'más' : 'menos'} que en el período anterior`;
}

/** Barras verticales por mes. Con muchos meses solo se rotula uno de cada tantos. */
function BarrasMeses({ datos }: { datos: { mes: string; cantidad: number }[] }) {
  const max = Math.max(1, ...datos.map((d) => d.cantidad));
  const salto = Math.ceil(datos.length / 6);
  return (
    <div role="img" aria-label={`Crisis por mes: ${datos.map((d) => `${nombreMes(d.mes)} ${d.cantidad}`).join(', ')}`}>
      <div className="flex h-40 items-end gap-1">
        {datos.map((d) => (
          <div key={d.mes} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="text-xs font-semibold tabular-nums">{d.cantidad || ''}</span>
            <div className={`w-full rounded-t ${colorCantidad(d.cantidad, max)}`} style={{ height: `${(d.cantidad / max) * 85}%`, minHeight: d.cantidad ? 4 : 1 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {datos.map((d, i) => (
          <span key={d.mes} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-xs text-slate-500">
            {i % salto === 0 ? nombreMes(d.mes).replace(' 20', ' ') : ''}
          </span>
        ))}
      </div>
      <LeyendaCantidad />
    </div>
  );
}

export function Estadisticas() {
  const crisis = useLiveQuery(listarCrisis, []);
  const planes = useLiveQuery(listarPlanes, []);
  const tomas = useLiveQuery(listarTomas, []);
  const [periodo, setPeriodo] = useState(ultimosMeses(6));
  if (!crisis) return null;

  const lista = crisis.filter((c) => enPeriodo(c, periodo));
  const r = resumen(lista, periodo);
  const meds = usoMedicacion(lista);
  const dias = diasDelPeriodo(crisis, periodo, hoy());
  const adh = adherencia(planes ?? [], tomas ?? [], periodo, ahoraLocal());
  // Solo se compara si ya se registraban crisis en el período anterior (la lista viene de más reciente a más antigua).
  const anterior = periodoAnterior(periodo);
  const hayAnterior = crisis.length > 0 && soloFecha(crisis[crisis.length - 1].inicio) <= anterior.hasta;
  const totalAnterior = crisis.filter((c) => enPeriodo(c, anterior)).length;

  return (
    <Pagina titulo="Estadísticas">
      <SelectorPeriodo periodo={periodo} onChange={setPeriodo} crisis={crisis} />

      <div className="grid grid-cols-2 gap-2">
        <Dato valor={String(r.total)} texto="crisis" nota={hayAnterior ? comparar(r.total, totalAnterior) : undefined} />
        <Dato valor={r.crisisPorMes.toFixed(1).replace('.', ',')} texto="promedio por mes" />
        <Dato valor={r.duracionMediaHoras === null ? '-' : formatoDuracion(r.duracionMediaHoras)} texto="duración promedio" />
        <Dato valor={String(r.diasPerdidos).replace('.', ',')} texto="días sin trabajar o estudiar" />
        <Dato valor={String(r.viaAerea)} texto="con lengua o garganta" />
        <Dato valor={String(r.porAtencion.emergencia + r.porAtencion.internacion)} texto="emergencias e internaciones" />
        <Dato valor={String(dias.libres)} texto="días sin crisis" nota={`de ${dias.dias} días del período`} />
        <Dato valor={String(dias.rachaLibre)} texto="días seguidos sin crisis" nota="la racha más larga" />
      </div>

      <Seccion titulo="Crisis por mes">
        <BarrasMeses datos={crisisPorMes(lista, periodo)} />
      </Seccion>
      <Seccion titulo="Gravedad">
        <BarrasH datos={[
          { etiqueta: 'Leve', cantidad: r.porGravedad.leve, clase: 'bg-amber-400' },
          { etiqueta: 'Moderada', cantidad: r.porGravedad.moderada, clase: 'bg-orange-500' },
          { etiqueta: 'Grave', cantidad: r.porGravedad.grave, clase: 'bg-red-600' },
        ]} />
      </Seccion>
      <Seccion titulo="Zonas más frecuentes">
        <BarrasH datos={frecuenciaZonas(lista)} />
      </Seccion>
      <Seccion titulo="Desencadenantes">
        <BarrasH datos={frecuenciaDesencadenantes(lista)} />
      </Seccion>
      <Seccion titulo="Síntomas previos">
        <BarrasH datos={frecuenciaProdromos(lista)} />
      </Seccion>
      <Seccion titulo="Uso de medicación">
        <p className="mb-3 text-slate-700">
          {r.tratadas} crisis con medicación de rescate, {r.noTratadas} sin medicación.
        </p>
        {meds.length === 0 ? (
          <p className="text-slate-500">Sin medicación registrada en este período.</p>
        ) : (
          <ul className="space-y-3">
            {meds.map((m) => (
              <li key={m.medicamento} className="rounded-xl border border-slate-200 p-3">
                <div className="font-medium">{m.medicamento}</div>
                <div className="text-sm text-slate-600">
                  {m.usos} dosis en {m.crisis} crisis. Funcionó: {m.funciono}, parcialmente: {m.parcial}, no funcionó: {m.noFunciono}
                  {m.sinDato ? `, sin dato: ${m.sinDato}` : ''}.
                </div>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
      {adh.porcentaje !== null && (
        <Seccion titulo="Tratamiento preventivo">
          <p className="mb-2 text-slate-700">
            Registraste {adh.tomadas} de {adh.esperadas} tomas ({adh.porcentaje} %).
          </p>
          <div className="h-3 rounded-full bg-slate-100" role="img" aria-label={`${adh.porcentaje} % de las tomas registradas`}>
            <div className="h-3 rounded-full bg-teal-600" style={{ width: `${adh.porcentaje}%` }} />
          </div>
        </Seccion>
      )}
      <p className="text-center text-sm text-slate-500">
        Los campos sin cargar no se cuentan. Cada crisis se asigna al mes en que empezó; los días sin crisis cuentan toda crisis activa ese día.
      </p>
    </Pagina>
  );
}
