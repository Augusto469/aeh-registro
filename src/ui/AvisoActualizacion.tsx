import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CADA_HORA = 60 * 60 * 1000;

/**
 * Registra el service worker (lo que deja la app disponible sin conexión) y avisa
 * cuando hay una versión nueva descargada, con un botón para aplicarla. Sin el aviso
 * había que cerrar la app del todo y volver a abrirla para ver los cambios.
 */
export function AvisoActualizacion() {
  const [registro, setRegistro] = useState<ServiceWorkerRegistration>();
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, r) => setRegistro(r),
  });

  // Busca versiones nuevas cada hora y cada vez que se vuelve a la app.
  useEffect(() => {
    if (!registro) return;
    const buscar = () => {
      if (navigator.onLine) void registro.update().catch(() => undefined);
    };
    const alVolver = () => {
      if (document.visibilityState === 'visible') buscar();
    };
    const reloj = setInterval(buscar, CADA_HORA);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [registro]);

  if (!hayVersionNueva) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-40 px-4">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-teal-700 bg-teal-50 p-3 shadow-lg">
        <p className="flex-1 text-teal-900">Hay una versión nueva de la app.</p>
        <button className="btn-primario min-h-[44px]" onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </button>
        <button className="btn min-h-[44px] px-3" aria-label="Más tarde" onClick={() => setHayVersionNueva(false)}>
          ✕
        </button>
      </div>
    </div>
  );
}
