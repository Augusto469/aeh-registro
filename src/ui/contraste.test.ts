/**
 * Comprueba que el texto se lea en modo claro y en modo oscuro, sin abrir un navegador.
 * Recorre el código buscando combinaciones de color de fondo y de texto, y calcula su
 * contraste con la paleta real (tema-colores.cjs) en los dos modos.
 *
 * Mínimo exigido: 4,5 a 1, el nivel AA de las pautas de accesibilidad (WCAG) para texto normal.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const { variables, FAMILIAS } = createRequire(import.meta.url)('../../tema-colores.cjs') as {
  variables: (oscuro: boolean) => Record<string, string>;
  FAMILIAS: string[];
};

const MINIMO = 4.5;
const MODOS = { claro: variables(false), oscuro: variables(true) };
const COLOR = new RegExp(`^(white|(?:${FAMILIAS.join('|')})-\\d{2,3})$`);

function luminancia(rgb: string): number {
  const [r, g, b] = rgb.split(' ').map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string, modo: Record<string, string>): number {
  const [l1, l2] = [luminancia(modo[`--c-${a}`]), luminancia(modo[`--c-${b}`])];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(tsx|css)$/.test(nombre) && !nombre.includes('.test.') ? [ruta] : [];
  });
}

/** Grupos de clases: cada texto entre comillas de un .tsx y cada regla @apply del CSS. */
function gruposDeClases(ruta: string): string[] {
  const texto = readFileSync(ruta, 'utf8');
  if (ruta.endsWith('.css')) return [...texto.matchAll(/@apply ([^;]+);/g)].map((m) => m[1]);
  return [...texto.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]);
}

interface Hallazgo {
  donde: string;
  fondo: string;
  texto: string;
}

/** Fondo y texto que aparecen juntos en un mismo grupo de clases (sin variantes como active: o focus:). */
function combinaciones(): { conFondo: Hallazgo[]; sueltos: Hallazgo[] } {
  const conFondo = new Map<string, Hallazgo>();
  const sueltos = new Map<string, Hallazgo>();
  for (const ruta of archivos('src')) {
    for (const grupo of gruposDeClases(ruta)) {
      const clases = grupo.split(/\s+/).filter((c) => !c.includes(':') && !c.includes('/'));
      const color = (prefijo: string) =>
        clases.filter((c) => c.startsWith(prefijo) && COLOR.test(c.slice(prefijo.length))).map((c) => c.slice(prefijo.length));
      const fondos = color('bg-');
      const textos = color('text-');
      const donde = ruta.replace(/\\/g, '/');
      for (const texto of textos) {
        if (fondos.length === 0) sueltos.set(texto, { donde, fondo: '', texto });
        for (const fondo of fondos) conFondo.set(`${fondo}|${texto}`, { donde, fondo, texto });
      }
    }
  }
  return { conFondo: [...conFondo.values()], sueltos: [...sueltos.values()] };
}

const { conFondo, sueltos } = combinaciones();

describe('contraste del texto en modo claro y oscuro', () => {
  it('encuentra combinaciones para revisar (si no, el rastreo dejó de funcionar)', () => {
    expect(conFondo.length).toBeGreaterThan(8);
    expect(sueltos.length).toBeGreaterThan(8);
  });

  for (const [nombre, modo] of Object.entries(MODOS)) {
    it(`modo ${nombre}: cada texto se lee sobre el fondo con el que está combinado`, () => {
      const fallas = conFondo
        .map((h) => ({ ...h, contraste: contraste(h.fondo, h.texto, modo) }))
        .filter((h) => h.contraste < MINIMO)
        .map((h) => `text-${h.texto} sobre bg-${h.fondo}: ${h.contraste.toFixed(2)} (${h.donde})`);
      expect(fallas).toEqual([]);
    });

    it(`modo ${nombre}: el texto sin fondo propio se lee sobre la página y sobre las tarjetas`, () => {
      // "white" como texto solo tiene sentido sobre un color fuerte: lo cubre el caso anterior.
      const fallas = sueltos
        .filter((h) => h.texto !== 'white')
        .flatMap((h) =>
          (['slate-50', 'white'] as const).map((fondo) => ({ ...h, fondo, contraste: contraste(fondo, h.texto, modo) })),
        )
        .filter((h) => h.contraste < MINIMO)
        .map((h) => `text-${h.texto} sobre bg-${h.fondo}: ${h.contraste.toFixed(2)} (${h.donde})`);
      expect(fallas).toEqual([]);
    });
  }
});
