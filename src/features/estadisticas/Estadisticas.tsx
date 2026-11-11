import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { listarCrisis } from '../../db/repo';
import { enPeriodo } from '../../domain/crisis';
import {
  crisisPorMes,
  frecuenciaDesencadenantes,
  frecuenciaProdromos,
  frecuenciaZonas,
  resumen,
  usoMedicacion,
} from '../../domain/estadisticas';
import { formatoDuracion, nombreMes } from '../../domain/fechas';
import { BarrasH, Pagina, Seccion } from '../../ui/componentes';
import { SelectorPeriodo, ultimosMeses } from '../../ui/SelectorPeriodo';

function Dato({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div className="tarjeta text-center">
      <div className="text-2xl font-bold tabular-nums">{valor}</div>
      <div className="text-sm text-slate-600">{texto}</div>
    </div>
  );
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
            <div className="w-full rounded-t bg-teal-600" style={{ height: `${(d.cantidad / max) * 85}%`, minHeight: d.cantidad ? 4 : 1 }} />
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
    </div>
  );
}

export function Estadisticas() {
  const crisis = useLiveQuery(listarCrisis, []);
  const [periodo, setPeriodo] = useState(ultimosMeses(6));
  if (!crisis) return null;

  const lista = crisis.filter((c) => enPeriodo(c, periodo));
  const r = resumen(lista, periodo);
  const meds = usoMedicacion(lista);

  return (
    <Pagina titulo="Estadísticas">
      <SelectorPeriodo periodo={periodo} onChange={setPeriodo} crisis={crisis} />

      <div className="grid grid-cols-2 gap-2">
        <Dato valor={String(r.total)} texto="crisis" />
        <Dato valor={r.crisisPorMes.toFixed(1).replace('.', ',')} texto="promedio por mes" />
        <Dato valor={r.duracionMediaHoras === null ? '-' : formatoDuracion(r.duracionMediaHoras)} texto="duración promedio" />
        <Dato valor={String(r.diasPerdidos)} texto="días sin trabajar o estudiar" />
        <Dato valor={String(r.viaAerea)} texto="con lengua o garganta" />
        <Dato valor={String(r.porAtencion.emergencia + r.porAtencion.internacion)} texto="emergencias e internaciones" />
      </div>

      <Seccion titulo="Crisis por mes">
        <BarrasMeses datos={crisisPorMes(lista, periodo)} />
      </Seccion>
      <Seccion titulo="Gravedad">
        <BarrasH datos={[
          { etiqueta: 'Leve', cantidad: r.porGravedad.leve },
          { etiqueta: 'Moderada', cantidad: r.porGravedad.moderada },
          { etiqueta: 'Grave', cantidad: r.porGravedad.grave },
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
      <p className="text-center text-sm text-slate-500">Los campos sin cargar no se cuentan. Cada crisis se asigna al mes en que empezó.</p>
    </Pagina>
  );
}
