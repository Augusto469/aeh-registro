import { Component, type ReactNode } from 'react';

/**
 * Si una pantalla falla, React desmonta todo y queda la página en blanco. Este límite
 * muestra un mensaje y una salida, y aclara que los datos guardados no se tocaron.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-10">
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="text-slate-700">
          La app tuvo un error al mostrar esta pantalla. Tus crisis guardadas siguen en el dispositivo: no se borró nada.
        </p>
        <button
          className="btn-primario w-full"
          onClick={() => {
            // Vuelve al inicio y recarga: descarta el estado que provocó el error.
            window.location.hash = '#/';
            window.location.reload();
          }}
        >
          Volver al inicio
        </button>
        <p className="break-words text-sm text-slate-500">Detalle técnico: {this.state.error.message}</p>
      </div>
    );
  }
}
