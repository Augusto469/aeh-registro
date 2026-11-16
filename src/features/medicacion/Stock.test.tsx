// @vitest-environment jsdom
/**
 * Tests del stock de la medicación de rescate, de punta a punta: se carga en la pantalla
 * Medicación, se registra una dosis en el formulario de una crisis y se comprueba el
 * descuento y los avisos del inicio.
 */
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { guardarCrisis, guardarMedicamento, listarMedicamentos, marcarBienvenidaVista } from '../../db/repo';
import { crearCrisis } from '../../domain/crisis';
import { ahoraLocal, soloFecha, sumarDias } from '../../domain/fechas';
import { Formulario } from '../crisis/Formulario';
import { Inicio } from '../inicio/Inicio';
import { Medicacion } from './Medicacion';

const hoy = () => soloFecha(ahoraLocal());
const icatibant = async () => (await listarMedicamentos()).find((m) => m.nombre === 'Icatibant')!;

function abrir(ruta: string) {
  const usuario = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/', ruta]} initialIndex={1}>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/medicacion" element={<Medicacion />} />
        <Route path="/crisis/:id" element={<Formulario />} />
      </Routes>
    </MemoryRouter>,
  );
  return usuario;
}

/** La tarjeta de un medicamento en la pantalla Medicación. */
const tarjeta = async (nombre: string) => (await screen.findByLabelText(`Unidades de ${nombre}`)).closest('li')!;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await marcarBienvenidaVista();
  window.confirm = () => true;
});

afterEach(cleanup);

describe('stock de la medicación de rescate', () => {
  it('se carga y se ajusta con los botones + y −', async () => {
    const usuario = abrir('/medicacion');
    const li = await tarjeta('Icatibant');
    const unidades = within(li).getByLabelText('Unidades de Icatibant');
    expect((await icatibant()).stock).toBeUndefined(); // al principio no se lleva la cuenta

    await usuario.type(unidades, '3');
    await usuario.tab(); // al salir del campo se guarda
    await waitFor(async () => expect((await icatibant()).stock).toBe(3));

    await usuario.click(within(li).getByRole('button', { name: 'Sumar una unidad' }));
    await usuario.click(within(li).getByRole('button', { name: 'Restar una unidad' }));
    await usuario.click(within(li).getByRole('button', { name: 'Restar una unidad' }));
    await waitFor(async () => expect((await icatibant()).stock).toBe(2));
    expect((unidades as HTMLInputElement).value).toBe('2');
  });

  it('avisa cuando queda poco y cuando está por vencer', async () => {
    const usuario = abrir('/medicacion');
    const li = await tarjeta('Icatibant');
    await usuario.type(within(li).getByLabelText('Unidades de Icatibant'), '2');
    await usuario.type(within(li).getByLabelText('Avisarme si quedan'), '2');
    await usuario.tab();
    expect(await within(li).findByText(/Icatibant: te quedan 2 unidades\./)).toBeTruthy();

    await guardarMedicamento({ ...(await icatibant()), vencimiento: sumarDias(hoy(), 10) });
    cleanup();
    abrir('/medicacion');
    expect(await within(await tarjeta('Icatibant')).findByText(/vence en 10 días/)).toBeTruthy();
  });

  it('registrar una dosis en una crisis descuenta una unidad, y volver a guardar no descuenta de nuevo', async () => {
    await guardarMedicamento({ ...(await icatibant()), stock: 3 });
    await guardarCrisis(crearCrisis({ id: 'c1', inicio: `${sumarDias(hoy(), -1)}T10:00`, fin: `${sumarDias(hoy(), -1)}T20:00` }));

    const usuario = abrir('/crisis/c1');
    await usuario.click(await screen.findByRole('button', { name: '+ Agregar medicación' }));
    // Elegir el medicamento de la lista (el botón con su nombre dentro de la dosis).
    await usuario.click(screen.getByRole('button', { name: 'Icatibant' }));
    await usuario.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);
    await waitFor(async () => expect((await icatibant()).stock).toBe(2));
    // La dosis habitual se completó sola y quedó guardada en la crisis.
    expect((await db.crisis.get('c1'))?.tratamientos?.[0]).toMatchObject({ medicamento: 'Icatibant', dosis: '30 mg subcutáneo' });

    cleanup();
    const otraVez = abrir('/crisis/c1');
    await otraVez.type(await screen.findByPlaceholderText('Por ejemplo: 1 g vía oral'), ' x');
    await otraVez.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);
    await waitFor(async () => expect((await db.crisis.get('c1'))?.tratamientos?.[0].dosis).toMatch(/ x$/));
    expect((await icatibant()).stock).toBe(2);
  });

  it('una dosis de un medicamento sin stock cargado no cambia nada', async () => {
    await guardarCrisis(crearCrisis({ id: 'c1', inicio: `${sumarDias(hoy(), -1)}T10:00`, fin: `${sumarDias(hoy(), -1)}T20:00` }));
    const usuario = abrir('/crisis/c1');
    await usuario.click(await screen.findByRole('button', { name: '+ Agregar medicación' }));
    await usuario.click(screen.getByRole('button', { name: 'Icatibant' }));
    await usuario.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);
    await waitFor(async () => expect((await db.crisis.get('c1'))?.tratamientos).toHaveLength(1));
    expect((await icatibant()).stock).toBeUndefined();
  });

  it('el inicio avisa cuando no queda ninguna unidad o está vencido', async () => {
    await guardarMedicamento({ ...(await icatibant()), stock: 0, vencimiento: sumarDias(hoy(), -2) });
    abrir('/');
    const aviso = (await screen.findByText('Revisá tu medicación de rescate')).closest('a')!;
    expect(within(aviso).getByText(/Icatibant: venció el/)).toBeTruthy();
    expect(within(aviso).getByText(/Icatibant: no te queda ninguna unidad\./)).toBeTruthy();
    expect(aviso.getAttribute('href')).toBe('/medicacion');
  });

  it('el inicio no muestra el aviso si no hay nada que revisar', async () => {
    await guardarMedicamento({ ...(await icatibant()), stock: 5, stockMinimo: 1, vencimiento: sumarDias(hoy(), 200) });
    abrir('/');
    await screen.findByText('+ Registrar crisis');
    expect(screen.queryByText('Revisá tu medicación de rescate')).toBeNull();
  });
});
