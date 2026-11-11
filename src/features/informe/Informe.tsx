import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { listarCrisis, obtenerPerfil } from '../../db/repo';
import { ahoraLocal } from '../../domain/fechas';
import { construirInforme } from '../../domain/informe';
import { PERFIL_VACIO } from '../../domain/tipos';
import { Pagina, Seccion, descargar } from '../../ui/componentes';
import { SelectorPeriodo, ultimosMeses } from '../../ui/SelectorPeriodo';
import type { FotoInforme } from './pdf';

/** Convierte una foto guardada en algo que jsPDF puede insertar (JPEG en base64 + medidas). */
async function prepararFoto(blob: Blob): Promise<FotoInforme | null> {
  try {
    const img = await createImageBitmap(blob);
    const lienzo = document.createElement('canvas');
    lienzo.width = img.width;
    lienzo.height = img.height;
    lienzo.getContext('2d')!.drawImage(img, 0, 0);
    return { dataUrl: lienzo.toDataURL('image/jpeg', 0.8), ancho: img.width, alto: img.height };
  } catch {
    return null;
  }
}

export function Informe() {
  const crisis = useLiveQuery(listarCrisis, []);
  const perfil = useLiveQuery(obtenerPerfil, []) ?? PERFIL_VACIO;
  const [periodo, setPeriodo] = useState(ultimosMeses(6));
  const [incluirNotas, setIncluirNotas] = useState(true);
  const [incluirFotos, setIncluirFotos] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  if (!crisis) return null;

  const datos = construirInforme(crisis, perfil, periodo, ahoraLocal());
  const nombreArchivo = `informe-aeh-${periodo.desde}-a-${periodo.hasta}.pdf`;

  const generar = async (): Promise<Blob> => {
    const fotos: Record<string, FotoInforme[]> = {};
    const ids = new Set(datos.detalle.map((f) => f.id));
    const medios = (await db.medios.toArray()).filter((m) => ids.has(m.crisisId));
    if (incluirFotos) {
      for (const m of medios.filter((x) => x.tipo === 'foto')) {
        const f = await prepararFoto(m.blob);
        if (f) (fotos[m.crisisId] ??= []).push(f);
      }
    }
    const videos = medios.filter((m) => m.tipo === 'video').length;
    const avisos = videos
      ? [...datos.avisos, `El paciente tiene ${videos} video(s) de estas crisis guardados en su celular; no se incluyen en este documento.`]
      : datos.avisos;
    const { generarPdf } = await import('./pdf');
    return generarPdf({ ...datos, avisos }, { incluirNotas, fotos });
  };

  const ejecutar = async (accion: (pdf: Blob) => Promise<void> | void) => {
    setOcupado(true);
    setError('');
    try {
      await accion(await generar());
    } catch (e) {
      // AbortError: la persona cerró el diálogo de compartir; no es un error.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError('No se pudo generar el informe.');
    } finally {
      setOcupado(false);
    }
  };

  const compartir = () =>
    ejecutar(async (pdf) => {
      const archivo = new File([pdf], nombreArchivo, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title: 'Informe de crisis de AEH' });
      } else {
        descargar(pdf, nombreArchivo); // el navegador no permite compartir archivos
      }
    });

  return (
    <Pagina titulo="Informe para el médico">
      <SelectorPeriodo periodo={periodo} onChange={setPeriodo} crisis={crisis} />

      <Seccion titulo="Qué incluir">
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={incluirNotas} onChange={(e) => setIncluirNotas(e.target.checked)} />
          Mis notas de cada crisis
        </label>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={incluirFotos} onChange={(e) => setIncluirFotos(e.target.checked)} />
          Fotos
        </label>
        <p className="mt-2 text-sm text-slate-500">
          El encabezado usa los datos que cargaste en Ajustes ({perfil.nombre ? perfil.nombre : 'todavía sin nombre'}).
        </p>
      </Seccion>

      <Seccion titulo="Vista previa del resumen" nota={datos.periodoTexto}>
        {datos.detalle.length === 0 ? (
          <p className="text-slate-500">No hay crisis registradas en este período.</p>
        ) : (
          <dl className="divide-y divide-slate-100">
            {datos.resumen.map((f) => (
              <div key={f.etiqueta} className="flex justify-between gap-4 py-2">
                <dt className="text-slate-600">{f.etiqueta}</dt>
                <dd className="text-right font-medium">{f.valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {datos.avisos.map((a) => (
          <p key={a} className="mt-2 text-sm text-amber-800">{a}</p>
        ))}
      </Seccion>

      {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      <button className="btn-primario min-h-[56px] w-full text-lg" disabled={ocupado || datos.detalle.length === 0} onClick={compartir}>
        {ocupado ? 'Generando…' : 'Compartir PDF'}
      </button>
      <button className="btn w-full" disabled={ocupado || datos.detalle.length === 0} onClick={() => ejecutar((pdf) => descargar(pdf, nombreArchivo))}>
        Descargar PDF
      </button>
      <p className="text-center text-sm text-slate-500">
        El PDF trae el resumen, gráficos y tablas del período y el detalle de cada crisis.
      </p>
    </Pagina>
  );
}
