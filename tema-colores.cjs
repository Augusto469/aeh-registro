/**
 * Paleta de la app en modo claro y oscuro. La usa tailwind.config.cjs para generar las
 * variables CSS y src/ui/contraste.test.ts para comprobar que el texto se lea en los dos modos.
 *
 * Modo oscuro sin tocar las pantallas: los colores salen de variables CSS. En modo claro
 * valen lo de siempre; en oscuro cada escala se invierte (el 50 pasa a ser el 950, el 100
 * el 900...). Así "bg-teal-50 text-teal-900" sigue teniendo contraste en los dos modos y
 * no hace falta escribir variantes `dark:` en cada componente.
 */
const colores = require('tailwindcss/colors');

const FAMILIAS = ['slate', 'teal', 'amber', 'orange', 'red', 'sky'];
const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** Excepciones a la inversión simple, para que en oscuro se distingan fondo, tarjeta y barras. */
const OSCURO_SLATE = { 50: 950, 100: 800, 200: 700, 300: 600, 400: 500, 500: 400, 600: 300, 700: 200, 800: 100, 900: 50, 950: 50 };

const aRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

/** Variables CSS de un modo: { '--c-slate-50': '248 250 252', ..., 'color-scheme': 'light' }. */
function variables(oscuro) {
  const v = {};
  for (const familia of FAMILIAS) {
    PASOS.forEach((paso, i) => {
      const origen = !oscuro ? paso : familia === 'slate' ? OSCURO_SLATE[paso] : PASOS[PASOS.length - 1 - i];
      v[`--c-${familia}-${paso}`] = aRgb(colores[familia][origen]);
    });
  }
  // "white" es la superficie de tarjetas y botones, y el texto sobre colores fuertes.
  v['--c-white'] = aRgb(oscuro ? colores.slate[900] : '#ffffff');
  v['color-scheme'] = oscuro ? 'dark' : 'light';
  return v;
}

module.exports = { FAMILIAS, PASOS, variables };
