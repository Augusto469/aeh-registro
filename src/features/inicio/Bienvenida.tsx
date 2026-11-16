import { useNavigate } from 'react-router-dom';
import { marcarBienvenidaVista } from '../../db/repo';

const PUNTOS: [string, string][] = [
  ['Registrá cada crisis en pocos toques', 'Con el registro rápido guardás zona y gravedad en el momento, y completás el resto cuando te sientas mejor.'],
  ['Tus datos quedan solo en este celular', 'No hay cuentas ni servidores: nadie más puede verlos. Por eso mismo, si perdés el celular o borrás los datos del navegador, se pierden.'],
  ['Hacé respaldos cada tanto', 'Desde Ajustes podés compartir un respaldo a tu correo o a la nube, protegido con contraseña si querés.'],
  ['Llevale el informe a tu médico', 'La app arma un PDF con el resumen del período, gráficos y el detalle de cada crisis.'],
];

/** Introducción que se muestra una sola vez, al abrir la app sin datos. También se abre desde Ajustes. */
export function Bienvenida() {
  const navegar = useNavigate();
  // Instalada, la app se abre "standalone" (sin barra del navegador). `standalone` es la variante de iPhone.
  const instalada =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const empezar = async () => {
    await marcarBienvenidaVista();
    navegar('/', { replace: true });
  };

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 pb-28 pt-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Te damos la bienvenida</p>
        <h1 className="mt-1 text-3xl font-bold">Registro de crisis de AEH</h1>
        <p className="mt-2 text-slate-600">Un diario personal de crisis de angioedema hereditario, para vos y para compartir con tu médico.</p>
      </header>

      <ol className="space-y-3">
        {PUNTOS.map(([titulo, texto], i) => (
          <li key={titulo} className="tarjeta flex gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal-700 font-semibold text-white" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h2 className="font-semibold">{titulo}</h2>
              <p className="text-slate-600">{texto}</p>
            </div>
          </li>
        ))}
      </ol>

      {!instalada && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <strong>Instalala para usarla sin conexión.</strong> En Android (Chrome): menú ⋮ y "Instalar app". En iPhone (Safari): botón Compartir y "Agregar a inicio".
        </div>
      )}

      <p className="text-sm text-slate-500">
        Esta app solo registra datos. No da recomendaciones médicas y no reemplaza a tu médico ni a un servicio de emergencias.
      </p>

      <button className="btn-primario min-h-[56px] w-full text-lg" onClick={empezar}>
        Empezar
      </button>
    </div>
  );
}
