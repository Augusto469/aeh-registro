/**
 * Cifrado opcional del respaldo con contraseña. Usa la Web Crypto API del navegador
 * (sin librerías): la clave sale de la contraseña con PBKDF2-SHA256 y el contenido se
 * cifra con AES-GCM de 256 bits, que además detecta si el archivo fue alterado.
 *
 * El archivo cifrado es un JSON chico ("sobre") con lo necesario para descifrarlo, menos
 * la contraseña. Si la contraseña se pierde, el respaldo no se puede recuperar.
 */
import { z } from 'zod';
import { APP_ID } from './respaldo';

/** Recomendación de OWASP (2023) para PBKDF2-SHA256. */
const ITERACIONES = 600_000;
const MAX_ITERACIONES = 5_000_000;
export const LARGO_MINIMO_CLAVE = 8;

const sobre = z.object({
  app: z.literal(APP_ID),
  cifrado: z.object({
    version: z.literal(1),
    kdf: z.literal('PBKDF2-SHA256'),
    iteraciones: z.number().int().min(1).max(MAX_ITERACIONES),
    sal: z.string().min(1),
    iv: z.string().min(1),
    datos: z.string().min(1),
  }),
});

function aBase64(bytes: Uint8Array): string {
  let texto = '';
  const TRAMO = 0x8000; // por tramos: String.fromCharCode no admite millones de argumentos
  for (let i = 0; i < bytes.length; i += TRAMO) texto += String.fromCharCode(...bytes.subarray(i, i + TRAMO));
  return btoa(texto);
}

function deBase64(texto: string): Uint8Array {
  const bin = atob(texto);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function derivarClave(clave: string, sal: Uint8Array, iteraciones: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: iteraciones, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** ¿El texto es un respaldo de esta app protegido con contraseña? */
export function esRespaldoCifrado(texto: string): boolean {
  try {
    const json = JSON.parse(texto) as { app?: unknown; cifrado?: unknown } | null;
    return !!json && json.app === APP_ID && typeof json.cifrado === 'object' && json.cifrado !== null;
  } catch {
    return false;
  }
}

/** Cifra el texto de un respaldo. Devuelve el texto del archivo cifrado. */
export async function cifrarRespaldo(texto: string, clave: string, iteraciones = ITERACIONES): Promise<string> {
  if (clave.length < LARGO_MINIMO_CLAVE)
    throw new Error(`La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const llave = await derivarClave(clave, sal, iteraciones);
  const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave, new TextEncoder().encode(texto));
  return JSON.stringify({
    app: APP_ID,
    cifrado: {
      version: 1,
      kdf: 'PBKDF2-SHA256',
      iteraciones,
      sal: aBase64(sal),
      iv: aBase64(iv),
      datos: aBase64(new Uint8Array(datos)),
    },
  });
}

/** Devuelve el texto original del respaldo. Lanza un Error en español si la contraseña no sirve. */
export async function descifrarRespaldo(textoCifrado: string, clave: string): Promise<string> {
  let json: unknown;
  try {
    json = JSON.parse(textoCifrado);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const r = sobre.safeParse(json);
  if (!r.success) throw new Error('El archivo cifrado no es un respaldo válido de esta app.');
  const { iteraciones, sal, iv, datos } = r.data.cifrado;
  try {
    const llave = await derivarClave(clave, deBase64(sal), iteraciones);
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(iv) }, llave, deBase64(datos));
    return new TextDecoder().decode(claro);
  } catch {
    // AES-GCM falla igual con contraseña equivocada que con el archivo alterado.
    throw new Error('Contraseña incorrecta o archivo dañado.');
  }
}
