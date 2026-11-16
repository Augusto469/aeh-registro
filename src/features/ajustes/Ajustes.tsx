import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import {
  eliminarMedicamento,
  exportarRespaldo,
  guardarMedicamento,
  guardarPerfil,
  importarRespaldo,
  listarCrisis,
  listarMedicamentos,
  obtenerPerfil,
  obtenerUltimoRespaldo,
  registrarRespaldoHecho,
} from '../../db/repo';
import { LARGO_MINIMO_CLAVE, cifrarRespaldo, descifrarRespaldo, esRespaldoCifrado } from '../../domain/cifrado';
import { nuevoId } from '../../domain/crisis';
import { crisisACsv } from '../../domain/csv';
import { ahoraLocal, formatoFecha, aLocal, soloFecha } from '../../domain/fechas';
import { parsearRespaldo } from '../../domain/respaldo';
import { PERFIL_VACIO, type Perfil } from '../../domain/tipos';
import { Pagina, Seccion, descargar } from '../../ui/componentes';

const CAMPOS_PERFIL: [keyof Perfil, string, string][] = [
  ['nombre', 'Nombre y apellido', 'text'],
  ['documento', 'Documento', 'text'],
  ['fechaNacimiento', 'Fecha de nacimiento', 'date'],
  ['diagnostico', 'Diagnóstico (por ejemplo: AEH tipo I)', 'text'],
  ['profilaxis', 'Tratamiento preventivo actual (profilaxis)', 'text'],
  ['medico', 'Médico tratante', 'text'],
];

function SeccionPerfil() {
  const guardado = useLiveQuery(obtenerPerfil, []);
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_VACIO);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (guardado) setPerfil(guardado);
  }, [guardado]);

  return (
    <Seccion titulo="Mis datos" nota="para el informe">
      <div className="space-y-3">
        {CAMPOS_PERFIL.map(([clave, etiqueta, tipo]) => (
          <label key={clave} className="block">
            <span className="etiqueta">{etiqueta}</span>
            <input className="campo" type={tipo} value={perfil[clave]}
              onChange={(e) => {
                setPerfil({ ...perfil, [clave]: e.target.value });
                setListo(false);
              }} />
          </label>
        ))}
        <button className="btn-primario w-full" onClick={async () => {
          await guardarPerfil(perfil);
          setListo(true);
        }}>
          {listo ? 'Guardado ✓' : 'Guardar mis datos'}
        </button>
        <p className="text-sm text-slate-500">Todos son opcionales. Solo aparecen en el encabezado del informe.</p>
      </div>
    </Seccion>
  );
}

function SeccionMedicamentos() {
  const medicamentos = useLiveQuery(listarMedicamentos, []) ?? [];
  const [nombre, setNombre] = useState('');
  return (
    <Seccion titulo="Mi medicación de rescate">
      <ul className="space-y-3">
        {medicamentos.map((m) => (
          <li key={m.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{m.nombre}</span>
              <button className="text-sm text-red-700 underline" onClick={() => confirm(`¿Quitar "${m.nombre}" de la lista?`) && void eliminarMedicamento(m.id)}>
                Quitar
              </button>
            </div>
            <input className="campo mt-2" placeholder="Dosis habitual (opcional)" defaultValue={m.dosisHabitual}
              onBlur={(e) => e.target.value !== m.dosisHabitual && void guardarMedicamento({ ...m, dosisHabitual: e.target.value })} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className="campo" placeholder="Agregar otro medicamento" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="btn" disabled={!nombre.trim()} onClick={async () => {
          await guardarMedicamento({ id: nuevoId(), nombre: nombre.trim(), dosisHabitual: '' });
          setNombre('');
        }}>
          Agregar
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-500">La dosis habitual se completa sola al registrar una crisis. Quitar un medicamento de la lista no cambia las crisis ya cargadas.</p>
    </Seccion>
  );
}

function SeccionRespaldo() {
  const ultimo = useLiveQuery(obtenerUltimoRespaldo, []);
  const [conMedios, setConMedios] = useState(false);
  const [conClave, setConClave] = useState(false);
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  /** Texto de un respaldo cifrado que espera su contraseña para importarse */
  const [cifradoPendiente, setCifradoPendiente] = useState<string | null>(null);
  const [claveImportar, setClaveImportar] = useState('');
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sello = () => soloFecha(ahoraLocal());

  const ejecutar = async (tarea: () => Promise<string>) => {
    setOcupado(true);
    setMensaje(null);
    try {
      setMensaje({ ok: true, texto: await tarea() });
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : 'Ocurrió un error.' });
    } finally {
      setOcupado(false);
    }
  };

  /** Arma el texto del respaldo (cifrado si se pidió) y un resumen de lo que lleva. */
  const prepararRespaldo = async () => {
    if (conClave) {
      if (clave.length < LARGO_MINIMO_CLAVE) throw new Error(`La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
      if (clave !== clave2) throw new Error('Las dos contraseñas no coinciden.');
    }
    const r = await exportarRespaldo(conMedios);
    const json = JSON.stringify(r);
    const texto = conClave ? await cifrarRespaldo(json, clave) : json;
    const resumen =
      `${r.crisis.filter((c) => !c.eliminadoEn).length} crisis` +
      (conMedios ? ` y ${r.medios?.length ?? 0} fotos o videos` : '') +
      (conClave ? ', protegido con contraseña' : '');
    return { texto, resumen, exportadoEn: r.exportadoEn };
  };

  const descargarRespaldo = () =>
    ejecutar(async () => {
      const { texto, resumen, exportadoEn } = await prepararRespaldo();
      descargar(new Blob([texto], { type: 'application/json' }), `respaldo-aeh-${sello()}.json`);
      await registrarRespaldoHecho(exportadoEn);
      return `Respaldo descargado: ${resumen}.`;
    });

  const compartirRespaldo = () =>
    ejecutar(async () => {
      const { texto, resumen, exportadoEn } = await prepararRespaldo();
      // Muchos celulares no dejan compartir archivos .json; como texto (.txt) sí.
      // El contenido es el mismo y la app importa cualquiera de los dos.
      const candidatos = [
        new File([texto], `respaldo-aeh-${sello()}.json`, { type: 'application/json' }),
        new File([texto], `respaldo-aeh-${sello()}.txt`, { type: 'text/plain' }),
      ];
      const archivo = candidatos.find((f) => navigator.canShare?.({ files: [f] }));
      if (!archivo) {
        descargar(candidatos[0], candidatos[0].name);
        await registrarRespaldoHecho(exportadoEn);
        return `Este navegador no permite compartir archivos, así que el respaldo se descargó: ${resumen}.`;
      }
      try {
        await navigator.share({ files: [archivo], title: 'Respaldo de crisis de AEH' });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw new Error('Se canceló: el respaldo no se compartió.');
        throw new Error('No se pudo compartir el respaldo. Probá con "Descargar".');
      }
      await registrarRespaldoHecho(exportadoEn);
      return `Respaldo compartido: ${resumen}.`;
    });

  const importarTexto = async (texto: string) => {
    const r = await importarRespaldo(parsearRespaldo(texto));
    return `Importación lista: ${r.nuevas} crisis nuevas, ${r.actualizadas} actualizadas, ${r.sinCambios} sin cambios${r.medios ? `, ${r.medios} fotos o videos` : ''}.`;
  };

  const importarArchivo = (archivo: File | undefined) =>
    archivo &&
    ejecutar(async () => {
      const texto = await archivo.text();
      if (esRespaldoCifrado(texto)) {
        setCifradoPendiente(texto);
        setClaveImportar('');
        return 'Este respaldo está protegido. Escribí la contraseña para importarlo.';
      }
      setCifradoPendiente(null);
      return importarTexto(texto);
    });

  const importarCifrado = () =>
    cifradoPendiente &&
    ejecutar(async () => {
      const resultado = await importarTexto(await descifrarRespaldo(cifradoPendiente, claveImportar));
      setCifradoPendiente(null);
      setClaveImportar('');
      return resultado;
    });

  const exportarCsv = () =>
    ejecutar(async () => {
      const lista = await listarCrisis();
      descargar(new Blob([crisisACsv(lista)], { type: 'text/csv;charset=utf-8' }), `crisis-aeh-${sello()}.csv`);
      return `CSV exportado con ${lista.length} crisis.`;
    });

  return (
    <Seccion titulo="Respaldo">
      <div className="space-y-3">
        <p className="text-slate-700">
          Tus datos están solo en este dispositivo. Si perdés el celular o borrás los datos del navegador, se pierden. Hacé un respaldo cada tanto y guardalo en otro lugar (Drive, correo, otra computadora).
        </p>
        <p className="text-sm text-slate-500">
          Último respaldo: {ultimo ? formatoFecha(aLocal(new Date(ultimo))) : 'nunca'}
        </p>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={conMedios} onChange={(e) => setConMedios(e.target.checked)} />
          Incluir fotos y videos (archivo más pesado)
        </label>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={conClave} onChange={(e) => setConClave(e.target.checked)} />
          Proteger con contraseña
        </label>
        {conClave && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3">
            <label className="block">
              <span className="etiqueta">Contraseña (mínimo {LARGO_MINIMO_CLAVE} caracteres)</span>
              <input className="campo" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
            </label>
            <label className="block">
              <span className="etiqueta">Repetir contraseña</span>
              <input className="campo" type="password" autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} />
            </label>
            <p className="text-sm text-amber-800">
              Sin la contraseña el respaldo no se puede abrir, y no hay forma de recuperarla. Anotala en un lugar seguro.
            </p>
          </div>
        )}
        <button className="btn-primario w-full" disabled={ocupado} onClick={compartirRespaldo}>
          {ocupado ? 'Preparando…' : 'Compartir respaldo'}
        </button>
        <button className="btn w-full" disabled={ocupado} onClick={descargarRespaldo}>
          Descargar respaldo (JSON)
        </button>
        <label className={`btn w-full cursor-pointer ${ocupado ? 'opacity-50' : ''}`}>
          Importar respaldo
          <input type="file" accept="application/json,text/plain,.json,.txt" className="hidden" disabled={ocupado}
            onChange={(e) => {
              void importarArchivo(e.target.files?.[0]);
              e.target.value = '';
            }} />
        </label>
        {cifradoPendiente && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3">
            <label className="block">
              <span className="etiqueta">Contraseña del respaldo</span>
              <input className="campo" type="password" autoComplete="off" value={claveImportar} onChange={(e) => setClaveImportar(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primario" disabled={ocupado || !claveImportar} onClick={importarCifrado}>
                Importar
              </button>
              <button className="btn" disabled={ocupado} onClick={() => { setCifradoPendiente(null); setMensaje(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        <button className="btn w-full" disabled={ocupado} onClick={exportarCsv}>
          Exportar planilla (CSV)
        </button>
        {mensaje && (
          <p role="status" className={`rounded-xl border p-3 ${mensaje.ok ? 'border-teal-300 bg-teal-50 text-teal-900' : 'border-red-300 bg-red-50 text-red-800'}`}>
            {mensaje.texto}
          </p>
        )}
        <p className="text-sm text-slate-500">
          Importar no borra nada: agrega las crisis que faltan y, si una está en los dos lados, queda la versión modificada más tarde. Sin contraseña, cualquiera que tenga el archivo puede leerlo; la planilla CSV nunca va cifrada.
        </p>
      </div>
    </Seccion>
  );
}

function SeccionAlmacenamiento() {
  const [estado, setEstado] = useState('');
  useEffect(() => {
    void (async () => {
      const persistente = await navigator.storage?.persisted?.();
      const uso = await navigator.storage?.estimate?.();
      const mb = uso?.usage ? ` Espacio usado: ${(uso.usage / 1048576).toFixed(1)} MB.` : '';
      setEstado(
        (persistente
          ? 'El navegador confirmó que no va a borrar estos datos por falta de espacio.'
          : 'El navegador podría borrar estos datos si falta espacio. Instalá la app en la pantalla de inicio y hacé respaldos.') + mb,
      );
    })();
  }, []);
  return (
    <Seccion titulo="Acerca de">
      <div className="space-y-2 text-slate-700">
        <p>Esta app solo registra datos. No da recomendaciones médicas ni reemplaza la consulta con tu médico.</p>
        <p>No envía información a ningún servidor.</p>
        {estado && <p className="text-sm text-slate-500">{estado}</p>}
      </div>
    </Seccion>
  );
}

export function Ajustes() {
  return (
    <Pagina titulo="Ajustes">
      <SeccionRespaldo />
      <SeccionMedicamentos />
      <SeccionPerfil />
      <SeccionAlmacenamiento />
    </Pagina>
  );
}
