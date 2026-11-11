# Decisiones técnicas

Cada punto dice qué se eligió y por qué. Si alguna deja de servir, este es el lugar para anotar el cambio.

## Arquitectura

- **Tres capas.** `domain/` son funciones puras (entra `Crisis[]`, salen números o textos). `db/repo.ts` es lo único que habla con IndexedDB. Las pantallas llaman al repositorio y al dominio. Así los tests no necesitan navegador y, si algún día hay sincronización, se cambia el repositorio y no las pantallas.
- **Sin gestor de estado.** `useLiveQuery` de Dexie vuelve a ejecutar la consulta cuando cambia la base, y con eso alcanza.
- **HashRouter y `base: './'`.** GitHub Pages no redirige rutas de una SPA. Con rutas tipo `#/historial` y rutas relativas la app funciona en cualquier subcarpeta sin configuración.

## Modelo de datos

- **`null` es "todavía no lo cargué".** Es distinto de "ninguno" (lista vacía, 0, `ninguna`). El registro rápido deja casi todo en `null`, y esos campos no se cuentan en las estadísticas; en el informe figuran como "Sin dato".
- **Fechas de la crisis como hora de reloj** (`2026-03-05T14:30`, sin zona horaria). Es lo que la persona vio en el reloj y lo que el médico quiere leer; no cambia si se viaja. Además es el formato de `<input type="datetime-local">` y se ordena como texto. `creadoEn` y `actualizadoEn` sí van en UTC, porque son para sincronizar.
- **`sinHora`** permite cargar crisis pasadas de las que solo se recuerda el día. La duración se calcula en días completos y se marca como aproximada.
- **Catálogos con códigos estables** (`laringe`, `estres`) y etiquetas aparte, para poder cambiar un texto sin migrar datos.
- **Desencadenantes y tratamientos son listas**: una crisis puede tener más de una causa sospechada y más de una dosis.
- **UUID, `actualizadoEn` y borrado lógico (`eliminadoEn`)** no cuestan nada ahora y son lo que necesita una sincronización. Importar un respaldo ya usa la regla "gana la última modificación".
- **Fotos y videos en una tabla aparte** (`medios`), para que listar crisis no cargue archivos. Las fotos se reducen a 1600 px de lado mayor en JPEG; los videos se guardan sin tocar, con un tope de 300 MB por archivo.
- **No hay `pacienteId`.** Hoy un dispositivo es un paciente. Se agrega con una migración de Dexie (`version(2)`) cuando haga falta.

## Estadísticas e informe

- Una crisis pertenece al mes y al período **en que empezó**.
- El promedio por mes divide por los meses reales del período (días / 30,44), no por los meses de calendario que toca.
- "Vía aérea" son las zonas lengua y garganta/laringe. Se resaltan en el informe.
- `domain/informe.ts` arma los datos (testeado) y `features/informe/pdf.ts` solo dibuja. jsPDF se carga recién al generar el informe.
- El detalle va en hoja apaisada para que entren las columnas.

## Respaldo

- El JSON lleva `app` y `version` y se valida completo con Zod antes de tocar la base.
- **Importar fusiona, no reemplaza.** Agrega lo que falta y nunca borra crisis locales.
- Las fotos y videos son opcionales en el respaldo y viajan en base64. Con muchos videos el archivo puede ser muy grande para generarlo en el celular.
- El CSV usa `;` y BOM porque es lo que Excel en español abre bien.

## Riesgos conocidos

- **El navegador puede borrar los datos** si falta espacio; en iPhone, también si la app no está instalada en la pantalla de inicio y no se usa por un tiempo. Se pide almacenamiento persistente al arrancar y el inicio avisa si pasaron más de 30 días sin respaldo.
- **Sin cifrado propio.** La protección es el bloqueo del celular. El respaldo tampoco está cifrado.
- **Toolchain fijado por Node 16** (Vite 4, Vitest 0.34, Workbox 7.0.0, configuración en CommonJS). Conviene actualizar Node y después estas dependencias.
- **Falta probar en un celular real**: instalación, cámara, compartir PDF y uso sin conexión, en Android y en iPhone.

## Para más adelante

- **Escalas AAS, AECT y AE-QoL:** tablas nuevas (`version(2)`), sin tocar `Crisis`.
- **Recordatorios de profilaxis y stock:** tabla nueva; las notificaciones de una PWA en iPhone exigen que esté instalada.
- **Varios pacientes y sincronización:** son datos sensibles según la Ley 18.331. Antes de guardar datos de otras personas en un servidor hacen falta consentimiento informado, cifrado en tránsito y en reposo, control de acceso y registro de la base ante la URCDP. Conviene asesorarse antes de diseñar esa parte.
