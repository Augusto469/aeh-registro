import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GRAVEDADES, type Gravedad } from '../domain/tipos';

export function Pagina(p: { titulo: string; atras?: boolean; accion?: ReactNode; children: ReactNode }) {
  const navegar = useNavigate();
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-4">
      <header className="mb-4 flex items-center gap-2">
        {p.atras && (
          <button className="btn min-h-[44px] px-3" onClick={() => navegar(-1)} aria-label="Volver">
            ←
          </button>
        )}
        <h1 className="flex-1 text-2xl font-bold">{p.titulo}</h1>
        {p.accion}
      </header>
      <div className="space-y-4">{p.children}</div>
    </div>
  );
}

export function Seccion(p: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="tarjeta">
      <h2 className="mb-3 flex items-baseline justify-between text-lg font-semibold">
        {p.titulo}
        {p.nota && <span className="text-sm font-normal text-slate-500">{p.nota}</span>}
      </h2>
      {p.children}
    </section>
  );
}

export function Chip(p: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={p.activo} className={`chip ${p.activo ? 'chip-activo' : ''}`} onClick={p.onClick}>
      {p.children}
    </button>
  );
}

/** Selección múltiple con chips a partir de un catálogo clave -> etiqueta. */
export function ChipsMultiples<K extends string>(p: {
  opciones: Record<K, string>;
  valores: readonly K[];
  onChange: (v: K[]) => void;
}) {
  const alternar = (k: K) =>
    p.onChange(p.valores.includes(k) ? p.valores.filter((x) => x !== k) : [...p.valores, k]);
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(p.opciones) as K[]).map((k) => (
        <Chip key={k} activo={p.valores.includes(k)} onClick={() => alternar(k)}>
          {p.opciones[k]}
        </Chip>
      ))}
    </div>
  );
}

/** Selección única con chips; tocar el activo lo desmarca (vuelve a "sin dato"). */
export function ChipsUnico<K extends string>(p: {
  opciones: Record<K, string>;
  valor: K | null;
  onChange: (v: K | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(p.opciones) as K[]).map((k) => (
        <Chip key={k} activo={p.valor === k} onClick={() => p.onChange(p.valor === k ? null : k)}>
          {p.opciones[k]}
        </Chip>
      ))}
    </div>
  );
}

const COLOR_GRAVEDAD: Record<Gravedad, string> = {
  leve: 'bg-amber-100 text-amber-900',
  moderada: 'bg-orange-200 text-orange-900',
  grave: 'bg-red-600 text-white',
};

export function Insignia(p: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${p.className ?? 'bg-slate-100 text-slate-700'}`}>
      {p.children}
    </span>
  );
}

export function InsigniaGravedad({ gravedad }: { gravedad: Gravedad | null }) {
  return gravedad ? <Insignia className={COLOR_GRAVEDAD[gravedad]}>{GRAVEDADES[gravedad]}</Insignia> : <Insignia>Sin gravedad</Insignia>;
}

/** Barras horizontales simples, sin librería de gráficos. */
export function BarrasH({ datos }: { datos: { etiqueta: string; cantidad: number }[] }) {
  const max = Math.max(1, ...datos.map((d) => d.cantidad));
  if (datos.length === 0) return <p className="text-slate-500">Sin datos en este período.</p>;
  return (
    <ul className="space-y-2">
      {datos.map((d) => (
        <li key={d.etiqueta}>
          <div className="flex justify-between text-sm">
            <span>{d.etiqueta}</span>
            <span className="font-semibold tabular-nums">{d.cantidad}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div className="h-3 rounded-full bg-teal-600" style={{ width: `${(d.cantidad / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Descarga un archivo generado en el navegador. */
export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
