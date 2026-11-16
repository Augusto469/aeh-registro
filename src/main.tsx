import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { limpiarMediosHuerfanos } from './db/repo';
import './index.css';

// El service worker (uso sin conexión y actualizaciones) se registra en ui/AvisoActualizacion.

// Pide al navegador que no borre los datos si falta espacio (puede negarse; por eso existe el respaldo).
void navigator.storage?.persist?.();
void limpiarMediosHuerfanos();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
