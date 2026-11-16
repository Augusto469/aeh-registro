import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import {
  eliminarMedicamento,
  eliminarPlan,
  guardarMedicamento,
  guardarPlan,
  listarMedicamentos,
  listarPlanes,
  terminarPlan,
} from '../../db/repo';
import { nuevoId } from '../../domain/crisis';
import { formatoFecha, sumarDias } from '../../domain/fechas';
import { avisosMedicacion } from '../../domain/medicacion';
import { crearPlan, textoFrecuencia, validarPlan } from '../../domain/profilaxis';
import type { Medicamento, PlanProfilaxis } from '../../domain/tipos';
import { Pagina, Seccion } from '../../ui/componentes';
import { hoy } from '../../ui/SelectorPeriodo';

const aNumero = (texto: string): number | null => {
  if (texto.trim() === '') return null;
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Un medicamento de rescate: dosis habitual y, si se quiere, stock y vencimiento. */
function FilaMedicamento({ m }: { m: Medicamento }) {
  const [dosis, setDosis] = useState(m.dosisHabitual);
  const [stock, setStock] = useState(m.stock ?? null);
  const [minimo, setMinimo] = useState(m.stockMinimo ?? null);
  const [vence, setVence] = useState(m.vencimiento ?? '');
  // El stock también cambia desde afuera (al registrar una dosis en una crisis).
  useEffect(() => setStock(m.stock ?? null), [m.stock]);

  const guardar = (cambios: Partial<Medicamento>) => void guardarMedicamento({ ...m, dosisHabitual: dosis, stock, stockMinimo: minimo, vencimiento: vence, ...cambios });
  const ajustarStock = (delta: number) => {
    const nuevo = Math.max(0, (stock ?? 0) + delta);
    setStock(nuevo);
    guardar({ stock: nuevo });
  };
  const avisos = avisosMedicacion([{ ...m, stock, stockMinimo: minimo, vencimiento: vence }], hoy());

  return (
    <li className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{m.nombre}</span>
        <button className="text-sm text-red-700 underline" onClick={() => confirm(`¿Quitar "${m.nombre}" de la lista?`) && void eliminarMedicamento(m.id)}>
          Quitar
        </button>
      </div>
      <label className="block">
        <span className="etiqueta">Dosis habitual (opcional)</span>
        <input className="campo" value={dosis} onChange={(e) => setDosis(e.target.value)} onBlur={() => dosis !== m.dosisHabitual && guardar({})} />
      </label>
      <div>
        <span className="etiqueta">Unidades que tengo (vacío = no llevar la cuenta)</span>
        <div className="flex gap-2">
          <button type="button" className="btn px-4" aria-label="Restar una unidad" onClick={() => ajustarStock(-1)} disabled={!stock}>
            −
          </button>
          <input
            className="campo text-center"
            type="number"
            inputMode="numeric"
            min={0}
            aria-label={`Unidades de ${m.nombre}`}
            value={stock ?? ''}
            onChange={(e) => setStock(aNumero(e.target.value))}
            onBlur={() => stock !== (m.stock ?? null) && guardar({})}
          />
          <button type="button" className="btn px-4" aria-label="Sumar una unidad" onClick={() => ajustarStock(1)}>
            +
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="etiqueta">Avisarme si quedan</span>
          <input
            className="campo"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Sin aviso"
            value={minimo ?? ''}
            onChange={(e) => setMinimo(aNumero(e.target.value))}
            onBlur={() => minimo !== (m.stockMinimo ?? null) && guardar({})}
          />
        </label>
        <label className="block">
          <span className="etiqueta">Vence</span>
          <input
            className="campo"
            type="date"
            value={vence}
            onChange={(e) => {
              setVence(e.target.value);
              guardar({ vencimiento: e.target.value });
            }}
          />
        </label>
      </div>
      {avisos.map((a) => (
        <p key={a.tipo} className={`text-sm ${a.urgente ? 'text-red-700' : 'text-amber-800'}`}>
          {a.texto}
        </p>
      ))}
    </li>
  );
}

function SeccionRescate() {
  const medicamentos = useLiveQuery(listarMedicamentos, []) ?? [];
  const [nombre, setNombre] = useState('');
  // Dos medicamentos con el mismo nombre confunden el descuento de stock (se busca por nombre).
  const repetido = medicamentos.some((m) => m.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  const agregar = async () => {
    if (repetido) return;
    await guardarMedicamento({ id: nuevoId(), nombre: nombre.trim(), dosisHabitual: '' });
    setNombre('');
  };
  return (
    <Seccion titulo="Medicación de rescate">
      <ul className="space-y-3">
        {medicamentos.map((m) => (
          <FilaMedicamento key={m.id} m={m} />
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className="campo" placeholder="Agregar otro medicamento" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="btn" disabled={!nombre.trim() || repetido} onClick={agregar}>
          Agregar
        </button>
      </div>
      {repetido && <p className="mt-2 text-sm text-amber-800">Ese medicamento ya está en la lista.</p>}
      <p className="mt-2 text-sm text-slate-500">
        La dosis habitual se completa sola al registrar una crisis. Si llevás la cuenta de unidades, cada dosis que registres en una crisis descuenta una. Quitar un medicamento de la lista no cambia las crisis ya cargadas.
      </p>
    </Seccion>
  );
}

const FRECUENCIAS = [1, 2, 3, 7, 14, 28];

function FormularioPlan({ sugerencias, alCerrar }: { sugerencias: string[]; alCerrar: () => void }) {
  const [plan, setPlan] = useState<PlanProfilaxis>(() => crearPlan({ medicamento: '', desde: hoy() }));
  const [error, setError] = useState('');
  const cambiar = (parcial: Partial<PlanProfilaxis>) => {
    setPlan({ ...plan, ...parcial });
    setError('');
  };
  const cambiarHorario = (i: number, valor: string) => cambiar({ horarios: plan.horarios.map((h, j) => (j === i ? valor : h)) });

  const guardar = async () => {
    const listo = { ...plan, medicamento: plan.medicamento.trim(), dosis: plan.dosis.trim(), horarios: [...plan.horarios].sort() };
    const problema = validarPlan(listo);
    if (problema) return setError(problema);
    await guardarPlan(listo);
    alCerrar();
  };

  return (
    <div className="space-y-3 rounded-xl border border-teal-700 p-3">
      <label className="block">
        <span className="etiqueta">Medicamento</span>
        <input className="campo" list="medicamentos-conocidos" value={plan.medicamento} onChange={(e) => cambiar({ medicamento: e.target.value })} />
        <datalist id="medicamentos-conocidos">
          {sugerencias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label className="block">
        <span className="etiqueta">Dosis de cada toma</span>
        <input className="campo" placeholder="Por ejemplo: 250 mg (1 comprimido)" value={plan.dosis} onChange={(e) => cambiar({ dosis: e.target.value })} />
      </label>
      <label className="block">
        <span className="etiqueta">Frecuencia</span>
        <select className="campo" value={plan.cadaDias} onChange={(e) => cambiar({ cadaDias: Number(e.target.value) })}>
          {FRECUENCIAS.map((n) => (
            <option key={n} value={n}>
              {textoFrecuencia(n).replace(/^./, (l) => l.toUpperCase())}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="etiqueta">Horarios del día</span>
        <div className="space-y-2">
          {plan.horarios.map((h, i) => (
            <div key={i} className="flex gap-2">
              <input className="campo" type="time" aria-label={`Horario ${i + 1}`} value={h} onChange={(e) => cambiarHorario(i, e.target.value)} />
              {plan.horarios.length > 1 && (
                <button type="button" className="btn px-4" aria-label={`Quitar horario ${i + 1}`} onClick={() => cambiar({ horarios: plan.horarios.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="mt-2 text-sm text-teal-800 underline" onClick={() => cambiar({ horarios: [...plan.horarios, '20:00'] })}>
          + Agregar otro horario
        </button>
      </div>
      <label className="block">
        <span className="etiqueta">Desde</span>
        <input className="campo" type="date" value={plan.desde} onChange={(e) => e.target.value && cambiar({ desde: e.target.value })} />
      </label>
      {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primario" onClick={guardar}>
          Guardar
        </button>
        <button className="btn" onClick={alCerrar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function SeccionPreventivo() {
  const planes = useLiveQuery(listarPlanes, []) ?? [];
  const medicamentos = useLiveQuery(listarMedicamentos, []) ?? [];
  const [agregando, setAgregando] = useState(false);

  const terminar = (p: PlanProfilaxis) =>
    confirm(`¿Terminar "${p.medicamento}"? Deja de aparecer en las tomas del día; lo ya registrado se conserva.`) &&
    void terminarPlan(p.id, sumarDias(hoy(), -1));
  const eliminar = (p: PlanProfilaxis) =>
    confirm(`¿Eliminar "${p.medicamento}" y todas sus tomas registradas? No se puede deshacer.`) && void eliminarPlan(p.id);

  return (
    <Seccion titulo="Tratamiento preventivo" nota="profilaxis">
      {planes.length === 0 && !agregando && <p className="mb-3 text-slate-600">No cargaste ningún tratamiento preventivo.</p>}
      <ul className="space-y-3">
        {planes.map((p) => {
          const terminado = p.hasta !== null && p.hasta < hoy();
          return (
            <li key={p.id} className={`rounded-xl border border-slate-200 p-3 ${terminado ? 'opacity-70' : ''}`}>
              <div className="font-medium">
                {p.medicamento}
                {p.dosis && <span className="font-normal text-slate-600"> · {p.dosis}</span>}
              </div>
              <p className="text-sm text-slate-600">
                {textoFrecuencia(p.cadaDias).replace(/^./, (l) => l.toUpperCase())}, a las {p.horarios.join(' y ')}.
              </p>
              <p className="text-sm text-slate-500">
                Desde el {formatoFecha(p.desde)}
                {p.hasta !== null && ` hasta el ${formatoFecha(p.hasta)}`}.
              </p>
              <div className="mt-2 flex gap-4 text-sm">
                {!terminado && (
                  <button className="text-teal-800 underline" onClick={() => terminar(p)}>
                    Terminar
                  </button>
                )}
                <button className="text-red-700 underline" onClick={() => eliminar(p)}>
                  Eliminar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        {agregando ? (
          <FormularioPlan sugerencias={medicamentos.map((m) => m.nombre)} alCerrar={() => setAgregando(false)} />
        ) : (
          <button className="btn w-full" onClick={() => setAgregando(true)}>
            + Agregar tratamiento preventivo
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Cargá lo que te indicó tu médico. La app no envía notificaciones: en el inicio te muestra las tomas del día para que las marques, y el informe cuenta cuántas registraste. Si cambia la indicación, terminá el tratamiento y agregá uno nuevo.
      </p>
    </Seccion>
  );
}

export function Medicacion() {
  return (
    <Pagina titulo="Medicación" atras>
      <SeccionPreventivo />
      <SeccionRescate />
    </Pagina>
  );
}
