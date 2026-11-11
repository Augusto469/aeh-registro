import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { listarCrisis } from '../../db/repo';
import { activaEnDia, filtrarCrisis, type Filtros } from '../../domain/crisis';
import { aDate, claveMes, nombreMes, sumarMeses } from '../../domain/fechas';
import { GRAVEDADES, ZONAS, type Crisis, type Gravedad } from '../../domain/tipos';
import { Pagina } from '../../ui/componentes';
import { hoy } from '../../ui/SelectorPeriodo';
import { TarjetaCrisis } from '../../ui/TarjetaCrisis';

const COLOR_DIA: Record<Gravedad | 'sin', string> = {
  leve: 'bg-amber-200 text-amber-950',
  moderada: 'bg-orange-300 text-orange-950',
  grave: 'bg-red-600 text-white',
  sin: 'bg-slate-300 text-slate-900',
};
const ORDEN: (Gravedad | 'sin')[] = ['sin', 'leve', 'moderada', 'grave'];

function Calendario({ crisis }: { crisis: Crisis[] }) {
  const [mes, setMes] = useState(claveMes(hoy()));
  const [dia, setDia] = useState<string | null>(null);
  const [anio, m] = mes.split('-').map(Number);
  const diasDelMes = new Date(anio, m, 0).getDate();
  // Semana de lunes a domingo: getDay() devuelve 0 para domingo.
  const huecos = (aDate(`${mes}-01`).getDay() + 6) % 7;
  const mover = (n: number) => {
    setMes(claveMes(sumarMeses(`${mes}-01`, n)));
    setDia(null);
  };
  const delDia = (d: string) => crisis.filter((c) => activaEnDia(c, d, hoy()));

  return (
    <div className="space-y-3">
      <div className="tarjeta">
        <div className="mb-3 flex items-center justify-between">
          <button className="btn min-h-[44px] px-4" onClick={() => mover(-1)} aria-label="Mes anterior">←</button>
          <span className="text-lg font-semibold capitalize">{nombreMes(mes, true)}</span>
          <button className="btn min-h-[44px] px-4" onClick={() => mover(1)} aria-label="Mes siguiente">→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <span key={i} className="text-sm text-slate-500">{d}</span>
          ))}
          {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} />)}
          {Array.from({ length: diasDelMes }, (_, i) => {
            const d = `${mes}-${String(i + 1).padStart(2, '0')}`;
            const lista = delDia(d);
            const peor = lista.reduce<Gravedad | 'sin' | null>((p, c) => {
              const g = c.gravedad ?? 'sin';
              return p === null || ORDEN.indexOf(g) > ORDEN.indexOf(p) ? g : p;
            }, null);
            return (
              <button key={d} onClick={() => setDia(d)} aria-label={`${i + 1}: ${lista.length} crisis`}
                className={`flex aspect-square items-center justify-center rounded-lg text-base ${peor ? COLOR_DIA[peor] : 'text-slate-700'} ${d === dia ? 'ring-2 ring-teal-700 ring-offset-1' : ''} ${d === hoy() ? 'font-bold underline' : ''}`}>
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
          {(['leve', 'moderada', 'grave'] as Gravedad[]).map((g) => (
            <span key={g} className="flex items-center gap-1">
              <span className={`inline-block h-3 w-3 rounded ${COLOR_DIA[g]}`} /> {GRAVEDADES[g]}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${COLOR_DIA.sin}`} /> Sin gravedad
          </span>
        </div>
      </div>
      {dia && (delDia(dia).length ? delDia(dia).map((c) => <TarjetaCrisis key={c.id} crisis={c} />) : <p className="text-center text-slate-500">Sin crisis ese día.</p>)}
    </div>
  );
}

export function Historial() {
  const crisis = useLiveQuery(listarCrisis, []);
  const [vista, setVista] = useState<'lista' | 'calendario'>('lista');
  const [verFiltros, setVerFiltros] = useState(false);
  const [f, setF] = useState<Filtros>({});
  if (!crisis) return null;

  const filtradas = filtrarCrisis(crisis, f);
  const activos = Object.values(f).filter(Boolean).length;
  const cambiar = (parcial: Filtros) => setF({ ...f, ...parcial });

  return (
    <Pagina titulo="Historial">
      <div className="grid grid-cols-3 gap-2">
        <button className={`chip justify-center ${vista === 'lista' ? 'chip-activo' : ''}`} onClick={() => setVista('lista')}>Lista</button>
        <button className={`chip justify-center ${vista === 'calendario' ? 'chip-activo' : ''}`} onClick={() => setVista('calendario')}>Calendario</button>
        <button className={`chip justify-center ${activos ? 'border-teal-700 text-teal-800' : ''}`} onClick={() => setVerFiltros(!verFiltros)} aria-expanded={verFiltros}>
          Filtros{activos ? ` (${activos})` : ''}
        </button>
      </div>

      {verFiltros && (
        <div className="tarjeta space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="etiqueta">Desde</span>
              <input className="campo" type="date" value={f.desde ?? ''} onChange={(e) => cambiar({ desde: e.target.value || undefined })} />
            </label>
            <label>
              <span className="etiqueta">Hasta</span>
              <input className="campo" type="date" value={f.hasta ?? ''} onChange={(e) => cambiar({ hasta: e.target.value || undefined })} />
            </label>
          </div>
          <label className="block">
            <span className="etiqueta">Zona</span>
            <select className="campo" value={f.zona ?? ''} onChange={(e) => cambiar({ zona: e.target.value || undefined })}>
              <option value="">Todas</option>
              {Object.entries(ZONAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="etiqueta">Gravedad</span>
            <select className="campo" value={f.gravedad ?? ''} onChange={(e) => cambiar({ gravedad: e.target.value || undefined })}>
              <option value="">Todas</option>
              {Object.entries(GRAVEDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="etiqueta">Medicación de rescate</span>
            <select className="campo" value={f.medicacion ?? ''} onChange={(e) => cambiar({ medicacion: e.target.value || undefined })}>
              <option value="">Todas</option>
              <option value="con">Con medicación</option>
              <option value="sin">Sin medicación</option>
            </select>
          </label>
          <label className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={!!f.soloIncompletas} onChange={(e) => cambiar({ soloIncompletas: e.target.checked || undefined })} />
            Solo las que falta completar
          </label>
          {activos > 0 && <button className="btn w-full" onClick={() => setF({})}>Quitar filtros</button>}
        </div>
      )}

      {vista === 'calendario' ? (
        <Calendario crisis={filtradas} />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {filtradas.length} crisis{activos ? ` de ${crisis.length}` : ''}
          </p>
          <div className="space-y-2">
            {filtradas.map((c) => <TarjetaCrisis key={c.id} crisis={c} />)}
          </div>
          {filtradas.length === 0 && <p className="tarjeta text-slate-600">{crisis.length ? 'Ninguna crisis coincide con los filtros.' : 'Todavía no hay crisis registradas.'}</p>}
        </>
      )}
    </Pagina>
  );
}
