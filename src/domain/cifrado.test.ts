import { describe, expect, it } from 'vitest';
import { cifrarRespaldo, descifrarRespaldo, esRespaldoCifrado } from './cifrado';
import { crearCrisis } from './crisis';
import { crearRespaldo, parsearRespaldo } from './respaldo';

// Pocas iteraciones para que los tests sean rápidos; la app usa el valor por defecto.
const ITER = 1000;
const CLAVE = 'clave de prueba 123';

const respaldo = () =>
  JSON.stringify(
    crearRespaldo({
      crisis: [crearCrisis({ id: 'a', inicio: '2026-01-01T10:00', notas: 'ñandú, 30 €' })],
      medicamentos: [],
      perfil: null,
    }),
  );

describe('cifrado del respaldo', () => {
  it('cifra y descifra sin perder nada', async () => {
    const original = respaldo();
    const cifrado = await cifrarRespaldo(original, CLAVE, ITER);
    expect(cifrado).not.toContain('ñandú');
    expect(esRespaldoCifrado(cifrado)).toBe(true);
    const claro = await descifrarRespaldo(cifrado, CLAVE);
    expect(claro).toBe(original);
    expect(parsearRespaldo(claro).crisis[0].notas).toBe('ñandú, 30 €');
  });

  it('usa sal e iv distintos cada vez', async () => {
    const a = await cifrarRespaldo(respaldo(), CLAVE, ITER);
    const b = await cifrarRespaldo(respaldo(), CLAVE, ITER);
    expect(a).not.toBe(b);
  });

  it('rechaza una contraseña equivocada', async () => {
    const cifrado = await cifrarRespaldo(respaldo(), CLAVE, ITER);
    await expect(descifrarRespaldo(cifrado, 'otra contraseña')).rejects.toThrow('Contraseña incorrecta');
  });

  it('detecta un archivo alterado', async () => {
    const sobre = JSON.parse(await cifrarRespaldo(respaldo(), CLAVE, ITER));
    const d: string = sobre.cifrado.datos;
    sobre.cifrado.datos = (d[0] === 'A' ? 'B' : 'A') + d.slice(1);
    await expect(descifrarRespaldo(JSON.stringify(sobre), CLAVE)).rejects.toThrow('Contraseña incorrecta');
  });

  it('no acepta contraseñas cortas', async () => {
    await expect(cifrarRespaldo(respaldo(), 'corta', ITER)).rejects.toThrow('al menos 8');
  });

  it('distingue un respaldo cifrado de uno común o de cualquier otro archivo', () => {
    expect(esRespaldoCifrado(respaldo())).toBe(false);
    expect(esRespaldoCifrado('no es json')).toBe(false);
    expect(esRespaldoCifrado('{"app":"otra","cifrado":{}}')).toBe(false);
  });

  it('un respaldo cifrado no pasa como respaldo común', async () => {
    const cifrado = await cifrarRespaldo(respaldo(), CLAVE, ITER);
    expect(() => parsearRespaldo(cifrado)).toThrow();
  });
});
