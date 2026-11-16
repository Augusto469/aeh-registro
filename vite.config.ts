import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import paquete from './package.json' with { type: 'json' };

export default defineConfig({
  // Rutas relativas: la app funciona igual en GitHub Pages (subcarpeta) o en la raíz.
  base: './',
  define: {
    // Se muestran en Ajustes > Acerca de, para saber qué versión quedó instalada.
    __APP_VERSION__: JSON.stringify(paquete.version),
    __APP_FECHA__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    {
      // Política de seguridad de contenido, solo en la versión publicada (en desarrollo Vite
      // necesita scripts en línea). La app no habla con ningún servidor: si por un error o una
      // dependencia comprometida algo intentara cargar código de afuera o enviar datos, el
      // navegador lo bloquea. Los estilos en línea se permiten porque React los usa en los gráficos.
      name: 'aeh-csp',
      apply: 'build',
      transformIndexHtml: () => [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data:",
              "media-src 'self' blob:",
              "connect-src 'self'",
              "worker-src 'self'",
              "manifest-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'none'",
            ].join('; '),
          },
          injectTo: 'head-prepend',
        },
      ],
    },
    VitePWA({
      // 'prompt': la versión nueva espera a que la persona toque "Actualizar" (ui/AvisoActualizacion).
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Registro de crisis de AEH',
        short_name: 'Crisis AEH',
        description: 'Registro personal de crisis de angioedema hereditario',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#0f766e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    // Los tests de pantallas (.tsx) piden jsdom con un comentario al inicio del archivo.
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
