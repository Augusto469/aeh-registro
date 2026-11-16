import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  eliminarBorrador,
  eliminarCrisis,
  guardarBorrador,
  guardarCrisis,
  listarMedicamentos,
  obtenerBorrador,
  obtenerCrisis,
} from '../../db/repo';
import { crearCrisis, nuevoId, validarCrisis } from '../../domain/crisis';
import { ahoraLocal, soloFecha } from '../../domain/fechas';
import {
  ATENCIONES,
  DESENCADENANTES,
  GRAVEDADES,
  PRODROMOS,
  RESPUESTAS,
  ZONAS,
  type Crisis,
  type RegistroEvolucion,
  type Tratamiento,
} from '../../domain/tipos';
import { AyudaGravedad, Chip, ChipsMultiples, ChipsUnico, Pagina, Seccion } from '../../ui/componentes';
import { Medios } from './Medios';

/** Campo de fecha que cambia entre "fecha y hora" y "solo fecha" según se recuerde o no la hora. */
function CampoFecha(p: { valor: string; sinHora: boolean; onChange: (v: string) => void; etiqueta: string }) {
  return (
    <label className="block">
      <span className="etiqueta">{p.etiqueta}</span>
      {p.sinHora ? (
        <input className="campo" type="date" value={soloFecha(p.valor)} onChange={(e) => e.target.value && p.onChange(`${e.target.value}T00:00`)} />
      ) : (
        <input className="campo" type="datetime-local" value={p.valor} onChange={(e) => e.target.value && p.onChange(e.target.value)} />
      )}
    </label>
  );
}

export function Formulario() {
  const { id } = useParams();
  const navegar = useNavigate();
  const esNueva = id === 'nueva';
  const [c, setC] = useState<Crisis | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [error, setError] = useState('');
  /** true si lo que se muestra salió de un borrador que no se había guardado */
  const [recuperado, setRecuperado] = useState(false);
  const saliendo = useRef(false);
  /** Hay cambios sin guardar: solo entonces se escribe el borrador. */
  const sucio = useRef(false);
  const actual = useRef<Crisis | null>(null);
  const medicamentos = useLiveQuery(listarMedicamentos, []) ?? [];

  const cargar = useCallback(
    async (usarBorrador: boolean): Promise<{ crisis: Crisis; deBorrador: boolean } | null> => {
      if (!id) return null;
      const borrador = usarBorrador ? await obtenerBorrador(id) : undefined;
      if (esNueva) {
        // Crisis pasada: arranca cerrada; las fechas se corrigen a mano.
        const ahora = ahoraLocal();
        return { crisis: borrador ?? crearCrisis({ inicio: ahora, fin: ahora }), deBorrador: !!borrador };
      }
      const guardada = await obtenerCrisis(id);
      if (!guardada) {
        void eliminarBorrador(id);
        return null;
      }
      return { crisis: borrador ?? guardada, deBorrador: !!borrador };
    },
    [id, esNueva],
  );

  const mostrar = (r: { crisis: Crisis; deBorrador: boolean } | null) => {
    if (!r) return setNoExiste(true);
    actual.current = r.crisis;
    sucio.current = r.deBorrador;
    setC(r.crisis);
    setRecuperado(r.deBorrador);
  };

  useEffect(() => {
    let vigente = true;
    void cargar(true).then((r) => vigente && mostrar(r));
    return () => {
      vigente = false;
    };
  }, [cargar]);

  // ----- Borrador automático -----
  // Lo que se va cargando se guarda aparte hasta tocar "Guardar". Así no se pierde si se
  // sale sin querer o si el celular recarga la app al volver de la cámara.
  const escribirBorrador = useCallback(() => {
    if (!id || !sucio.current || saliendo.current || !actual.current) return;
    void guardarBorrador(id, actual.current);
  }, [id]);

  useEffect(() => {
    actual.current = c;
    if (!sucio.current) return;
    const t = setTimeout(escribirBorrador, 400);
    return () => clearTimeout(t);
  }, [c, escribirBorrador]);

  useEffect(() => {
    // Al abrir la cámara o cambiar de app la página queda oculta: se guarda en el momento.
    const alOcultar = () => {
      if (document.visibilityState === 'hidden') escribirBorrador();
    };
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', escribirBorrador);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      window.removeEventListener('pagehide', escribirBorrador);
      escribirBorrador(); // al salir de la pantalla sin guardar
    };
  }, [escribirBorrador]);

  if (noExiste) return <Pagina titulo="Crisis" atras><p>No se encontró esta crisis.</p></Pagina>;
  if (!c || !id) return null;

  const cambiar = (parcial: Partial<Crisis>) => {
    sucio.current = true;
    setC({ ...c, ...parcial });
    setError('');
  };

  /** Una foto agregada también cuenta como cambio: el borrador conserva la crisis a la que pertenece. */
  const alAgregarMedio = () => {
    sucio.current = true;
    escribirBorrador();
  };

  const descartarBorrador = async () => {
    if (!confirm(esNueva ? '¿Descartar lo cargado y empezar de cero?' : '¿Descartar los cambios sin guardar?')) return;
    sucio.current = false;
    await eliminarBorrador(id);
    mostrar(await cargar(false));
  };

  // `saliendo` evita que un doble toque guarde dos veces y retroceda dos pantallas.
  const guardar = async () => {
    if (saliendo.current) return;
    const problema = validarCrisis(c);
    if (problema) return setError(problema);
    saliendo.current = true;
    try {
      await guardarCrisis(c);
      await eliminarBorrador(id);
      navegar(-1);
    } catch {
      saliendo.current = false;
      setError('No se pudo guardar la crisis. Puede que falte espacio en el dispositivo.');
    }
  };

  const eliminar = async () => {
    if (saliendo.current) return;
    if (!confirm('¿Eliminar esta crisis y sus fotos? No se puede deshacer.')) return;
    saliendo.current = true;
    try {
      await eliminarCrisis(c.id);
      await eliminarBorrador(id);
      navegar(-1);
    } catch {
      saliendo.current = false;
      setError('No se pudo eliminar la crisis.');
    }
  };

  const alternarSinHora = (sinHora: boolean) =>
    cambiar({
      sinHora,
      inicio: sinHora ? `${soloFecha(c.inicio)}T00:00` : c.inicio,
      fin: c.fin && sinHora ? `${soloFecha(c.fin)}T00:00` : c.fin,
    });

  // ----- Medicación -----
  const trats = c.tratamientos;
  const cambiarTrat = (tid: string, parcial: Partial<Tratamiento>) =>
    cambiar({ tratamientos: (trats ?? []).map((t) => (t.id === tid ? { ...t, ...parcial } : t)) });
  const agregarTrat = () =>
    cambiar({
      tratamientos: [
        ...(trats ?? []),
        { id: nuevoId(), medicamento: '', dosis: '', hora: c.fin === null ? ahoraLocal() : null, respuesta: null },
      ],
    });
  const quitarTrat = (tid: string) => {
    const resto = (trats ?? []).filter((t) => t.id !== tid);
    cambiar({ tratamientos: resto.length ? resto : null });
  };
  // ----- Evolución -----
  const evol = c.evolucion ?? [];
  const cambiarEvol = (eid: string, parcial: Partial<RegistroEvolucion>) =>
    cambiar({ evolucion: evol.map((e) => (e.id === eid ? { ...e, ...parcial } : e)) });
  const agregarEvol = () =>
    cambiar({ evolucion: [...evol, { id: nuevoId(), hora: c.fin === null ? ahoraLocal() : c.inicio, gravedad: null, nota: '' }] });

  const elegirMedicamento = (t: Tratamiento, nombre: string) => {
    const m = medicamentos.find((x) => x.nombre === nombre);
    cambiarTrat(t.id, { medicamento: nombre, dosis: t.dosis || m?.dosisHabitual || '' });
  };

  return (
    <Pagina
      titulo={esNueva ? 'Nueva crisis' : 'Crisis'}
      atras
      accion={
        <button className="btn-primario" onClick={guardar}>
          Guardar
        </button>
      }
    >
      {recuperado && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p>{esNueva ? 'Recuperamos lo que estabas cargando y no llegaste a guardar.' : 'Esta crisis tiene cambios que no llegaste a guardar.'}</p>
          <button type="button" className="mt-1 text-sm underline" onClick={descartarBorrador}>
            {esNueva ? 'Descartar y empezar de cero' : 'Descartar esos cambios'}
          </button>
        </div>
      )}
      {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}

      <Seccion titulo="Cuándo">
        <div className="space-y-3">
          <CampoFecha etiqueta="Inicio" valor={c.inicio} sinHora={c.sinHora} onChange={(inicio) => cambiar({ inicio })} />
          {c.fin !== null && <CampoFecha etiqueta="Fin" valor={c.fin} sinHora={c.sinHora} onChange={(fin) => cambiar({ fin })} />}
          <label className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={c.fin === null}
              onChange={(e) => cambiar({ fin: e.target.checked ? null : c.sinHora ? `${soloFecha(ahoraLocal())}T00:00` : ahoraLocal() })} />
            Sigue en curso
          </label>
          <label className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={c.sinHora} onChange={(e) => alternarSinHora(e.target.checked)} />
            No recuerdo la hora (solo el día)
          </label>
        </div>
      </Seccion>

      <Seccion titulo="Zonas afectadas">
        <ChipsMultiples opciones={ZONAS} valores={c.zonas} onChange={(zonas) => cambiar({ zonas })} />
        {c.zonas.includes('otra') && (
          <input className="campo mt-3" placeholder="¿Cuál?" value={c.zonaOtra} onChange={(e) => cambiar({ zonaOtra: e.target.value })} />
        )}
      </Seccion>

      <Seccion titulo="Gravedad">
        <ChipsUnico opciones={GRAVEDADES} valor={c.gravedad} onChange={(gravedad) => cambiar({ gravedad })} />
        <AyudaGravedad />
      </Seccion>

      <Seccion titulo="Síntomas previos" nota="pródromos">
        <div className="mb-2">
          <Chip activo={c.prodromos !== null && c.prodromos.length === 0} onClick={() => cambiar({ prodromos: c.prodromos?.length === 0 ? null : [] })}>
            Ninguno
          </Chip>
        </div>
        <ChipsMultiples opciones={PRODROMOS} valores={c.prodromos ?? []} onChange={(v) => cambiar({ prodromos: v.length ? v : null })} />
        {c.prodromos?.includes('otro') && (
          <input className="campo mt-3" placeholder="¿Cuál?" value={c.prodromoOtro} onChange={(e) => cambiar({ prodromoOtro: e.target.value })} />
        )}
      </Seccion>

      <Seccion titulo="Desencadenante sospechado">
        <ChipsMultiples opciones={DESENCADENANTES} valores={c.desencadenantes ?? []} onChange={(v) => cambiar({ desencadenantes: v.length ? v : null })} />
        {c.desencadenantes?.includes('otro') && (
          <input className="campo mt-3" placeholder="¿Cuál?" value={c.desencadenanteOtro} onChange={(e) => cambiar({ desencadenanteOtro: e.target.value })} />
        )}
      </Seccion>

      <Seccion titulo="Medicación de rescate">
        {trats === null || trats.length === 0 ? (
          <div className="mb-3">
            <Chip activo={trats !== null} onClick={() => cambiar({ tratamientos: trats === null ? [] : null })}>
              No usé medicación
            </Chip>
          </div>
        ) : (
          <div className="mb-3 space-y-4">
            {trats.map((t, i) => (
              <div key={t.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Dosis {i + 1}</span>
                  <button type="button" className="text-sm text-red-700 underline" onClick={() => quitarTrat(t.id)}>
                    Quitar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {medicamentos.map((m) => (
                    <Chip key={m.id} activo={t.medicamento === m.nombre} onClick={() => elegirMedicamento(t, m.nombre)}>
                      {m.nombre}
                    </Chip>
                  ))}
                </div>
                <label className="block">
                  <span className="etiqueta">Medicamento</span>
                  <input className="campo" placeholder="Elegí arriba o escribí otro" value={t.medicamento} onChange={(e) => cambiarTrat(t.id, { medicamento: e.target.value })} />
                </label>
                <label className="block">
                  <span className="etiqueta">Dosis</span>
                  <input className="campo" placeholder="Por ejemplo: 1 g vía oral" value={t.dosis} onChange={(e) => cambiarTrat(t.id, { dosis: e.target.value })} />
                </label>
                <label className="block">
                  <span className="etiqueta">Hora en que la tomé</span>
                  <input className="campo" type="datetime-local" value={t.hora ?? ''} onChange={(e) => cambiarTrat(t.id, { hora: e.target.value || null })} />
                </label>
                <div>
                  <span className="etiqueta">¿Funcionó?</span>
                  <ChipsUnico opciones={RESPUESTAS} valor={t.respuesta} onChange={(respuesta) => cambiarTrat(t.id, { respuesta })} />
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="btn w-full" onClick={agregarTrat}>
          + Agregar medicación
        </button>
      </Seccion>

      <Seccion titulo="Atención médica">
        <ChipsUnico opciones={ATENCIONES} valor={c.atencion} onChange={(atencion) => cambiar({ atencion })} />
      </Seccion>

      <Seccion titulo="Impacto">
        <label className="block">
          <span className="etiqueta">Días sin poder trabajar o estudiar</span>
          <input className="campo" type="number" inputMode="decimal" min={0} step={0.5} value={c.diasPerdidos ?? ''}
            onChange={(e) => cambiar({ diasPerdidos: e.target.value === '' ? null : Number(e.target.value) })} />
        </label>
      </Seccion>

      <Seccion titulo="Evolución" nota="opcional">
        <p className="mb-3 text-sm text-slate-600">Anotá cómo fue cambiando la crisis: cuándo empeoró, cuándo empezó a ceder.</p>
        {evol.length > 0 && (
          <div className="mb-3 space-y-4">
            {evol.map((e, i) => (
              <div key={e.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Momento {i + 1}</span>
                  <button type="button" className="text-sm text-red-700 underline" onClick={() => cambiar({ evolucion: evol.filter((x) => x.id !== e.id) })}>
                    Quitar
                  </button>
                </div>
                <label className="block">
                  <span className="etiqueta">Cuándo</span>
                  <input className="campo" type="datetime-local" value={e.hora} onChange={(ev) => ev.target.value && cambiarEvol(e.id, { hora: ev.target.value })} />
                </label>
                <div>
                  <span className="etiqueta">Cómo estaba</span>
                  <ChipsUnico opciones={GRAVEDADES} valor={e.gravedad} onChange={(gravedad) => cambiarEvol(e.id, { gravedad })} />
                </div>
                <label className="block">
                  <span className="etiqueta">Nota</span>
                  <input className="campo" placeholder="Por ejemplo: empezó a bajar la hinchazón" value={e.nota} onChange={(ev) => cambiarEvol(e.id, { nota: ev.target.value })} />
                </label>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="btn w-full" onClick={agregarEvol}>
          + Agregar momento
        </button>
      </Seccion>

      <Seccion titulo="Notas">
        <textarea className="campo" rows={4} value={c.notas} onChange={(e) => cambiar({ notas: e.target.value })} />
      </Seccion>

      <Seccion titulo="Fotos y videos">
        <Medios crisisId={c.id} alAgregar={alAgregarMedio} />
      </Seccion>

      {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      <button className="btn-primario min-h-[56px] w-full text-lg" onClick={guardar}>
        Guardar
      </button>
      {!esNueva && (
        <button className="btn-peligro w-full" onClick={eliminar}>
          Eliminar crisis
        </button>
      )}
    </Pagina>
  );
}
