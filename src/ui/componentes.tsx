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

/** Criterio para elegir la gravedad: cuánto limita la crisis la actividad diaria. */
export function AyudaGravedad() {
  return (
    <ul className="mt-3 space-y-1 text-sm text-slate-600">
      <li><strong className="text-slate-800">Leve:</strong> notás los síntomas, pero hacés tu vida normal.</li>
      <li><strong className="text-slate-800">Moderada:</strong> te cuesta hacer tus actividades habituales o tenés que cambiarlas.</li>
      <li><strong className="text-slate-800">Grave:</strong> no podés hacer tus actividades habituales.</li>
      <li className="text-slate-500">Marcá la gravedad máxima que alcanzó la crisis.</li>
    </ul>
  );
}

/**
 * Escala de un solo color, de claro a oscuro: cuanto mayor es la cantidad respecto
 * del máximo del gráfico, más oscuro el tono. Las clases van escritas completas
 * para que Tailwind las incluya.
 */
const TONOS_CANTIDAD = ['bg-teal-300', 'bg-teal-500', 'bg-teal-700', 'bg-teal-900'];

export function colorCantidad(cantidad: number, max: number): string {
  if (cantidad <= 0 || max <= 0) return TONOS_CANTIDAD[0];
  const paso = Math.ceil((cantidad / max) * TONOS_CANTIDAD.length) - 1;
  return TONOS_CANTIDAD[Math.min(TONOS_CANTIDAD.length - 1, Math.max(0, paso))];
}

/** Explica la escala de `colorCantidad` debajo de un gráfico. */
export function LeyendaCantidad() {
  return (
    <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
      Menos
      <span className="flex gap-0.5" aria-hidden="true">
        {TONOS_CANTIDAD.map((t) => (
          <span key={t} className={`inline-block h-3 w-5 rounded-sm ${t}`} />
        ))}
      </span>
      Más crisis
    </p>
  );
}

/**
 * Barras horizontales simples, sin librería de gráficos. Por defecto el tono de cada
 * barra depende de su cantidad; `clase` lo reemplaza cuando el color identifica otra cosa
 * (por ejemplo, la gravedad).
 */
export function BarrasH({ datos }: { datos: { etiqueta: string; cantidad: number; clase?: string }[] }) {
  const max = Math.max(1, ...datos.map((d) => d.cantidad));
  if (datos.length === 0) return <p className="text-slate-500">Sin datos en este período.</p>;
  const porCantidad = datos.some((d) => !d.clase);
  return (
    <>
      <ul className="space-y-2">
        {datos.map((d) => (
          <li key={d.etiqueta}>
            <div className="flex justify-between text-sm">
              <span>{d.etiqueta}</span>
              <span className="font-semibold tabular-nums">{d.cantidad}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div className={`h-3 rounded-full ${d.clase ?? colorCantidad(d.cantidad, max)}`} style={{ width: `${(d.cantidad / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {porCantidad && <LeyendaCantidad />}
    </>
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
