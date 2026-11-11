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
} from '../../db/repo';
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

  const exportarJson = () =>
    ejecutar(async () => {
      const r = await exportarRespaldo(conMedios);
      descargar(new Blob([JSON.stringify(r)], { type: 'application/json' }), `respaldo-aeh-${sello()}.json`);
      return `Respaldo exportado: ${r.crisis.filter((c) => !c.eliminadoEn).length} crisis${conMedios ? ` y ${r.medios?.length ?? 0} fotos o videos` : ''}.`;
    });

  const importarJson = (archivo: File | undefined) =>
    archivo &&
    ejecutar(async () => {
      const r = await importarRespaldo(parsearRespaldo(await archivo.text()));
      return `Importación lista: ${r.nuevas} crisis nuevas, ${r.actualizadas} actualizadas, ${r.sinCambios} sin cambios${r.medios ? `, ${r.medios} fotos o videos` : ''}.`;
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
          Tus datos están solo en este dispositivo. Si perdés el celular o borrás los datos del navegador, se pierden. Exportá un respaldo cada tanto y guardalo en otro lugar.
        </p>
        <p className="text-sm text-slate-500">
          Último respaldo: {ultimo ? formatoFecha(aLocal(new Date(ultimo))) : 'nunca'}
        </p>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={conMedios} onChange={(e) => setConMedios(e.target.checked)} />
          Incluir fotos y videos (archivo más pesado)
        </label>
        <button className="btn-primario w-full" disabled={ocupado} onClick={exportarJson}>
          Exportar respaldo (JSON)
        </button>
        <label className={`btn w-full cursor-pointer ${ocupado ? 'opacity-50' : ''}`}>
          Importar respaldo (JSON)
          <input type="file" accept="application/json,.json" className="hidden" disabled={ocupado}
            onChange={(e) => {
              void importarJson(e.target.files?.[0]);
              e.target.value = '';
            }} />
        </label>
        <button className="btn w-full" disabled={ocupado} onClick={exportarCsv}>
          Exportar planilla (CSV)
        </button>
        {mensaje && (
          <p role="status" className={`rounded-xl border p-3 ${mensaje.ok ? 'border-teal-300 bg-teal-50 text-teal-900' : 'border-red-300 bg-red-50 text-red-800'}`}>
            {mensaje.texto}
          </p>
        )}
        <p className="text-sm text-slate-500">
          Importar no borra nada: agrega las crisis que faltan y, si una está en los dos lados, queda la versión modificada más tarde. El respaldo no está cifrado: guardalo en un lugar privado.
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
