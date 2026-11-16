const plugin = require('tailwindcss/plugin');
const { FAMILIAS, PASOS, variables } = require('./tema-colores.cjs');

// Los colores salen de variables CSS para tener modo oscuro sin variantes `dark:` (ver tema-colores.cjs).
const conVariable = (nombre) => `rgb(var(--c-${nombre}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        white: conVariable('white'),
        ...Object.fromEntries(
          FAMILIAS.map((f) => [f, Object.fromEntries(PASOS.map((p) => [p, conVariable(`${f}-${p}`)]))]),
        ),
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': variables(false),
        // Sigue al sistema, salvo que en Ajustes se haya elegido "Claro".
        '@media (prefers-color-scheme: dark)': { ':root:not([data-tema="claro"])': variables(true) },
        ':root[data-tema="oscuro"]': variables(true),
      });
    }),
  ],
};
