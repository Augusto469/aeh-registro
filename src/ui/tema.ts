/**
 * Apariencia: seguir al sistema, o forzar claro u oscuro. Es una preferencia de este
 * dispositivo, así que vive en localStorage (no en la base ni en el respaldo). El mismo
 * valor lo lee un script en index.html antes de dibujar, para que no parpadee.
 */
export const TEMAS = { sistema: 'Según el celular', claro: 'Claro', oscuro: 'Oscuro' } as const;
export type Tema = keyof typeof TEMAS;

const CLAVE = 'aeh-tema';
const COLOR_BARRA = { claro: '#0f766e', oscuro: '#0f172a' };

export function leerTema(): Tema {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === 'claro' || t === 'oscuro' ? t : 'sistema';
  } catch {
    return 'sistema'; // almacenamiento bloqueado (por ejemplo, ventana privada)
  }
}

export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === 'sistema') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);
  // Color de la barra del sistema: una etiqueta por modo; al forzar un tema valen igual las dos.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const propio = m.media.includes('dark') ? 'oscuro' : 'claro';
    m.content = COLOR_BARRA[tema === 'sistema' ? propio : tema];
  });
}

export function guardarTema(tema: Tema): void {
  try {
    if (tema === 'sistema') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, tema);
  } catch {
    // sin almacenamiento, el tema vale solo hasta cerrar la app
  }
  aplicarTema(tema);
}
