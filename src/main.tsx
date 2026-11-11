import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { limpiarMediosHuerfanos } from './db/repo';
import './index.css';

// Service worker: deja la app en caché para usarla sin conexión y la actualiza sola.
registerSW({ immediate: true });

// Pide al navegador que no borre los datos si falta espacio (puede negarse; por eso existe el respaldo).
void navigator.storage?.persist?.();
void limpiarMediosHuerfanos();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
