// @vitest-environment jsdom
/**
 * Tests de la sección Respaldo de Ajustes, manejando la pantalla como una persona:
 * marcar casillas, escribir contraseñas, tocar botones y elegir archivos.
 *
 * Lo que hace el celular al compartir no se puede probar acá. Sí se prueba qué hace la
 * app en cada caso posible: si el celular acepta .json, si solo acepta .txt, si no deja
 * compartir archivos y si la persona cancela.
 */
import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { webcrypto } from 'node:crypto';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { exportarRespaldo, guardarCrisis, listarCrisis, obtenerUltimoRespaldo } from '../../db/repo';
import { cifrarRespaldo, descifrarRespaldo, esRespaldoCifrado } from '../../domain/cifrado';
import { crearCrisis } from '../../domain/crisis';
import { parsearRespaldo } from '../../domain/respaldo';
import { descargar } from '../../ui/componentes';
import { Ajustes } from './Ajustes';

// La descarga real crea un enlace y lo "toca"; acá solo interesa qué archivo se generó.
vi.mock('../../ui/componentes', async (original) => ({
  ...(await original<typeof import('../../ui/componentes')>()),
  descargar: vi.fn(),
}));

const CLAVE = 'clave de prueba 123';
const descargado = () => vi.mocked(descargar).mock.calls.at(-1)?.[0] as Blob;
/** Lee un archivo generado por la pantalla (los de jsdom se leen con FileReader). */
const textoDe = (b: Blob) =>
  new Promise<string>((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(lector.error);
    lector.readAsText(b);
  });

/** Simula un celular: qué archivos acepta compartir y qué pasa al hacerlo. */
function simularCompartir(acepta: (archivo: File) => boolean, alCompartir: () => Promise<void> = async () => undefined) {
  const share = vi.fn(async (_datos: ShareData) => alCompartir());
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d: ShareData) => !!d.files?.every(acepta) });
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  return share;
}

const estado = () => screen.findByRole('status');
const boton = (nombre: RegExp | string) => screen.getByRole('button', { name: nombre });

async function abrir() {
  const usuario = userEvent.setup();
  render(
    <MemoryRouter>
      <Ajustes />
    </MemoryRouter>,
  );
  await screen.findByText(/Último respaldo: nunca/);
  return usuario;
}

async function ponerClave(usuario: ReturnType<typeof userEvent.setup>, clave: string, repetida = clave) {
  await usuario.click(screen.getByLabelText('Proteger con contraseña'));
  if (clave) await usuario.type(screen.getByLabelText(/^Contraseña \(mínimo/), clave);
  if (repetida) await usuario.type(screen.getByLabelText('Repetir contraseña'), repetida);
}

const elegirArchivo = (usuario: ReturnType<typeof userEvent.setup>, archivo: File) =>
  usuario.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, archivo);

beforeEach(async () => {
  // jsdom no trae el cifrado del navegador; Node sí, con la misma interfaz.
  if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);
  await db.delete();
  await db.open();
  await guardarCrisis(crearCrisis({ id: 'a', inicio: '2026-01-01T10:00', zonas: ['cara'], notas: 'dato privado' }));
  vi.mocked(descargar).mockClear();
});

afterEach(() => {
  cleanup();
  // Sin canShare ni share: un navegador que no comparte archivos.
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
});

describe('respaldo con contraseña', () => {
  it('no deja exportar con una contraseña corta o que no coincide', async () => {
    const usuario = await abrir();
    await ponerClave(usuario, 'corta');
    await usuario.click(boton('Descargar respaldo (JSON)'));
    expect((await estado()).textContent).toMatch(/al menos 8 caracteres/);

    await usuario.clear(screen.getByLabelText(/^Contraseña \(mínimo/));
    await usuario.clear(screen.getByLabelText('Repetir contraseña'));
    await usuario.type(screen.getByLabelText(/^Contraseña \(mínimo/), CLAVE);
    await usuario.type(screen.getByLabelText('Repetir contraseña'), 'otra cosa distinta');
    await usuario.click(boton('Descargar respaldo (JSON)'));
    expect((await estado()).textContent).toMatch(/no coinciden/);

    expect(descargar).not.toHaveBeenCalled();
    expect(await obtenerUltimoRespaldo()).toBeNull();
  });

  it('descarga el respaldo cifrado: no se lee sin la contraseña y con ella se recupera todo', async () => {
    const usuario = await abrir();
    await ponerClave(usuario, CLAVE);
    await usuario.click(boton('Descargar respaldo (JSON)'));
    expect((await estado()).textContent).toBe('Respaldo descargado: 1 crisis, protegido con contraseña.');

    const archivo = await textoDe(descargado());
    expect(esRespaldoCifrado(archivo)).toBe(true);
    expect(archivo).not.toContain('dato privado');
    expect(parsearRespaldo(await descifrarRespaldo(archivo, CLAVE)).crisis[0].notas).toBe('dato privado');
    expect(await obtenerUltimoRespaldo()).toBeTruthy();
  });

  it('sin contraseña descarga el respaldo legible', async () => {
    const usuario = await abrir();
    await usuario.click(boton('Descargar respaldo (JSON)'));
    expect((await estado()).textContent).toBe('Respaldo descargado: 1 crisis.');
    expect(parsearRespaldo(await textoDe(descargado())).crisis[0].notas).toBe('dato privado');
  });

  it('importa un respaldo cifrado: pide la contraseña, rechaza la equivocada y acepta la correcta', async () => {
    const cifrado = await cifrarRespaldo(JSON.stringify(await exportarRespaldo(false)), CLAVE);
    await db.crisis.clear(); // como si fuera un celular nuevo
    const usuario = await abrir();

    await elegirArchivo(usuario, new File([cifrado], 'respaldo.json', { type: 'application/json' }));
    expect((await estado()).textContent).toMatch(/Escribí la contraseña/);
    expect(await listarCrisis()).toHaveLength(0);

    const campo = screen.getByLabelText('Contraseña del respaldo');
    await usuario.type(campo, 'contraseña equivocada');
    await usuario.click(boton('Importar'));
    expect((await screen.findByText(/Contraseña incorrecta/)).textContent).toMatch(/archivo dañado/);
    expect(await listarCrisis()).toHaveLength(0);

    await usuario.clear(campo);
    await usuario.type(campo, CLAVE);
    await usuario.click(boton('Importar'));
    expect((await screen.findByText(/Importación lista/)).textContent).toMatch(/1 crisis nuevas/);
    expect((await listarCrisis())[0].notas).toBe('dato privado');
    // Ya importado, el pedido de contraseña desaparece.
    expect(screen.queryByLabelText('Contraseña del respaldo')).toBeNull();
  });

  it('importa un respaldo compartido como .txt y rechaza un archivo cualquiera', async () => {
    const texto = JSON.stringify(await exportarRespaldo(false));
    await db.crisis.clear();
    const usuario = await abrir();

    await elegirArchivo(usuario, new File(['hola, no soy un respaldo'], 'nota.txt', { type: 'text/plain' }));
    expect((await estado()).textContent).toMatch(/no es un JSON válido/);
    expect(await listarCrisis()).toHaveLength(0);

    await elegirArchivo(usuario, new File([texto], 'respaldo-aeh.txt', { type: 'text/plain' }));
    expect((await screen.findByText(/Importación lista/)).textContent).toMatch(/1 crisis nuevas/);
    expect(await listarCrisis()).toHaveLength(1);
  });
});

describe('compartir respaldo', () => {
  it('si el celular acepta .json, comparte el .json', async () => {
    const share = simularCompartir(() => true);
    const usuario = await abrir();
    await usuario.click(boton('Compartir respaldo'));
    expect((await estado()).textContent).toBe('Respaldo compartido: 1 crisis.');

    const archivo = share.mock.calls[0][0].files![0];
    expect(archivo.name).toMatch(/^respaldo-aeh-\d{4}-\d{2}-\d{2}\.json$/);
    expect(parsearRespaldo(await textoDe(archivo)).crisis).toHaveLength(1);
    expect(await obtenerUltimoRespaldo()).toBeTruthy();
  });

  it('si el celular solo acepta texto, comparte el mismo contenido como .txt', async () => {
    const share = simularCompartir((f) => f.type === 'text/plain');
    const usuario = await abrir();
    await usuario.click(boton('Compartir respaldo'));
    expect((await estado()).textContent).toBe('Respaldo compartido: 1 crisis.');

    const archivo = share.mock.calls[0][0].files![0];
    expect(archivo.name).toMatch(/\.txt$/);
    // El .txt se puede importar tal cual.
    expect(parsearRespaldo(await textoDe(archivo)).crisis[0].notas).toBe('dato privado');
    expect(descargar).not.toHaveBeenCalled();
  });

  it('si el celular no deja compartir archivos, lo descarga y lo avisa', async () => {
    const usuario = await abrir(); // sin canShare ni share
    await usuario.click(boton('Compartir respaldo'));
    expect((await estado()).textContent).toMatch(/no permite compartir archivos, así que el respaldo se descargó/);
    expect(descargar).toHaveBeenCalledTimes(1);
    expect(await obtenerUltimoRespaldo()).toBeTruthy();
  });

  it('si la persona cancela, lo dice y no da el respaldo por hecho', async () => {
    simularCompartir(
      () => true,
      () => Promise.reject(new DOMException('cancelado', 'AbortError')),
    );
    const usuario = await abrir();
    await usuario.click(boton('Compartir respaldo'));
    expect((await estado()).textContent).toMatch(/Se canceló/);
    expect(await obtenerUltimoRespaldo()).toBeNull();
    expect(screen.getByText(/Último respaldo: nunca/)).toBeTruthy();
  });

  it('comparte cifrado cuando se pidió contraseña', async () => {
    const share = simularCompartir((f) => f.type === 'text/plain');
    const usuario = await abrir();
    await ponerClave(usuario, CLAVE);
    await usuario.click(boton('Compartir respaldo'));
    expect((await estado()).textContent).toBe('Respaldo compartido: 1 crisis, protegido con contraseña.');

    const texto = await textoDe(share.mock.calls[0][0].files![0]);
    expect(esRespaldoCifrado(texto)).toBe(true);
    expect(texto).not.toContain('dato privado');
  });
});
