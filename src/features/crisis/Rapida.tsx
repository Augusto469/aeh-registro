import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guardarCrisis } from '../../db/repo';
import { crearCrisis } from '../../domain/crisis';
import { ahoraLocal } from '../../domain/fechas';
import { GRAVEDADES, ZONAS, type Gravedad, type Zona } from '../../domain/tipos';
import { ChipsMultiples, ChipsUnico, Pagina, Seccion } from '../../ui/componentes';

/** Registro rápido: zona, gravedad y guardar. El resto se completa después. */
export function Rapida() {
  const navegar = useNavigate();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [gravedad, setGravedad] = useState<Gravedad | null>(null);
  const [inicio, setInicio] = useState(ahoraLocal());

  const guardar = async (completar: boolean) => {
    const c = crearCrisis({ zonas, gravedad, inicio: inicio || ahoraLocal() });
    await guardarCrisis(c);
    navegar(completar ? `/crisis/${c.id}` : '/', { replace: true });
  };

  return (
    <Pagina titulo="Registro rápido" atras>
      <Seccion titulo="¿Dónde?">
        <ChipsMultiples opciones={ZONAS} valores={zonas} onChange={setZonas} />
      </Seccion>
      <Seccion titulo="¿Qué tan fuerte?">
        <ChipsUnico opciones={GRAVEDADES} valor={gravedad} onChange={setGravedad} />
      </Seccion>
      <Seccion titulo="¿Cuándo empezó?">
        <input className="campo" type="datetime-local" value={inicio} max={ahoraLocal()} onChange={(e) => setInicio(e.target.value)} />
      </Seccion>
      <button className="btn-primario min-h-[64px] w-full text-xl" onClick={() => guardar(false)}>
        Guardar
      </button>
      <button className="btn w-full" onClick={() => guardar(true)}>
        Guardar y completar ahora
      </button>
      <p className="text-center text-sm text-slate-500">Queda como crisis en curso. La cerrás desde el inicio cuando termine.</p>
    </Pagina>
  );
}
