import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Ajustes } from '../features/ajustes/Ajustes';
import { Estadisticas } from '../features/estadisticas/Estadisticas';
import { Historial } from '../features/historial/Historial';
import { Informe } from '../features/informe/Informe';
import { Formulario } from '../features/crisis/Formulario';
import { Rapida } from '../features/crisis/Rapida';
import { Bienvenida } from '../features/inicio/Bienvenida';
import { Inicio } from '../features/inicio/Inicio';
import { Medicacion } from '../features/medicacion/Medicacion';
import { AvisoActualizacion } from '../ui/AvisoActualizacion';
import { ErrorBoundary } from '../ui/ErrorBoundary';

const PESTANAS = [
  { a: '/', texto: 'Inicio', icono: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { a: '/historial', texto: 'Historial', icono: 'M4 6h16M4 12h16M4 18h16' },
  { a: '/estadisticas', texto: 'Estadísticas', icono: 'M5 20V10M12 20V4M19 20v-7' },
  { a: '/informe', texto: 'Informe', icono: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
  { a: '/ajustes', texto: 'Ajustes', icono: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6' },
];

/**
 * HashRouter (rutas tipo #/historial): GitHub Pages no sabe redirigir rutas
 * de una SPA, y con el hash la app funciona en cualquier subcarpeta sin configuración.
 */
/** Al cambiar de pantalla, vuelve arriba (si no, queda el scroll de la pantalla anterior). */
function VolverArriba() {
  const { pathname } = useLocation();
  // Con llaves: el efecto no debe devolver nada. En navegadores nuevos scrollTo
  // devuelve una promesa y React falla si la recibe como función de limpieza.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <VolverArriba />
      <main>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/rapida" element={<Rapida />} />
            <Route path="/crisis/:id" element={<Formulario />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/estadisticas" element={<Estadisticas />} />
            <Route path="/informe" element={<Informe />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route path="/medicacion" element={<Medicacion />} />
            <Route path="/bienvenida" element={<Bienvenida />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <AvisoActualizacion />
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {PESTANAS.map((p) => (
            <li key={p.a}>
              <NavLink
                to={p.a}
                end={p.a === '/'}
                className={({ isActive }) =>
                  `flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'font-semibold text-teal-700' : 'text-slate-500'}`
                }
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={p.icono} />
                </svg>
                {p.texto}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </HashRouter>
  );
}
