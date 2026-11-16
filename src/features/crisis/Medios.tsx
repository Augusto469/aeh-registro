import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type ChangeEvent } from 'react';
import { agregarMedio, eliminarMedio, listarMedios } from '../../db/repo';
import { nuevoId } from '../../domain/crisis';
import type { Medio } from '../../domain/tipos';

const LADO_MAXIMO = 1600;
const MAX_VIDEO_MB = 300;

/**
 * Las fotos se achican antes de guardarlas (lado mayor de 1600 px, JPEG):
 * una foto de celular pasa de varios MB a unos cientos de KB sin perder lo que
 * el médico necesita ver. Los videos se guardan tal cual.
 */
export async function comprimirFoto(archivo: Blob): Promise<Blob> {
  try {
    const img = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext('2d')!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    img.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.82));
    return blob ?? archivo;
  } catch {
    return archivo; // formato que el navegador no sabe decodificar: se guarda el original
  }
}

/** Crea una URL temporal para mostrar un Blob y la libera al desmontar. */
export function useUrlDeBlob(blob: Blob): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function Miniatura({ medio, onAbrir }: { medio: Medio; onAbrir: () => void }) {
  const url = useUrlDeBlob(medio.blob);
  return (
    <button type="button" onClick={onAbrir} className="relative aspect-square overflow-hidden rounded-xl bg-slate-200" aria-label={`Abrir ${medio.tipo}`}>
      {url && medio.tipo === 'foto' && <img src={url} alt="" className="h-full w-full object-cover" />}
      {url && medio.tipo === 'video' && <video src={url} className="h-full w-full object-cover" muted preload="metadata" />}
      {medio.tipo === 'video' && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-xs text-[#fff]">Video</span>}
    </button>
  );
}

function Visor({ medio, onCerrar }: { medio: Medio; onCerrar: () => void }) {
  const url = useUrlDeBlob(medio.blob);
  const borrar = async () => {
    if (!confirm(`¿Eliminar ${medio.tipo === 'foto' ? 'esta foto' : 'este video'}?`)) return;
    await eliminarMedio(medio.id);
    onCerrar();
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex justify-between p-3">
        <button type="button" className="btn" onClick={onCerrar}>
          Cerrar
        </button>
        <button type="button" className="btn-peligro" onClick={borrar}>
          Eliminar
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {url && medio.tipo === 'foto' && <img src={url} alt="Foto de la crisis" className="max-h-full max-w-full object-contain" />}
        {url && medio.tipo === 'video' && <video src={url} controls playsInline className="max-h-full max-w-full" />}
      </div>
    </div>
  );
}

export function Medios({ crisisId, alAgregar }: { crisisId: string; alAgregar?: () => void }) {
  const medios = useLiveQuery(() => listarMedios(crisisId), [crisisId]);
  const [abierto, setAbierto] = useState<Medio | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const agregar = async (archivos: FileList | null) => {
    if (!archivos) return;
    setOcupado(true);
    setError('');
    try {
      for (const a of Array.from(archivos)) {
        const esVideo = a.type.startsWith('video/');
        if (esVideo && a.size > MAX_VIDEO_MB * 1024 * 1024) {
          setError(`"${a.name}" pesa más de ${MAX_VIDEO_MB} MB y no se guardó.`);
          continue;
        }
        const blob = esVideo ? a : await comprimirFoto(a);
        await agregarMedio({
          id: nuevoId(),
          crisisId,
          tipo: esVideo ? 'video' : 'foto',
          blob,
          mime: blob.type || a.type,
          nombre: a.name,
          creadoEn: new Date().toISOString(),
        });
        alAgregar?.();
      }
    } catch {
      setError('No se pudo guardar el archivo. Puede que falte espacio en el dispositivo.');
    } finally {
      setOcupado(false);
    }
  };

  const alElegir = (e: ChangeEvent<HTMLInputElement>) => {
    void agregar(e.target.files);
    e.target.value = '';
  };

  return (
    <div>
      {medios && medios.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {medios.map((m) => (
            <Miniatura key={m.id} medio={m} onAbrir={() => setAbierto(m)} />
          ))}
        </div>
      )}
      {/*
        Tres entradas separadas: en Android, un selector que acepta fotos y videos a la vez
        abre solo la galería. Con `capture` y un solo tipo, el celular abre la cámara directo.
      */}
      {ocupado ? (
        <p className="btn w-full">Guardando…</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="btn cursor-pointer">
              Tomar foto
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={alElegir} />
            </label>
            <label className="btn cursor-pointer">
              Grabar video
              <input type="file" accept="video/*" capture="environment" className="hidden" onChange={alElegir} />
            </label>
          </div>
          <label className="btn w-full cursor-pointer">
            Elegir de la galería
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={alElegir} />
          </label>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {abierto && <Visor medio={abierto} onCerrar={() => setAbierto(null)} />}
    </div>
  );
}
