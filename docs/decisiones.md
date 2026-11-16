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
- **Contraseña opcional** (`domain/cifrado.ts`): la clave sale de la contraseña con PBKDF2-SHA256 (600.000 iteraciones) y el contenido se cifra con AES-GCM de 256 bits, todo con la Web Crypto API del navegador, sin librerías. El archivo cifrado es un JSON con `app` y `cifrado` (sal, iv y datos en base64). Si se pierde la contraseña no hay recuperación.
- **Compartir** usa la hoja de compartir del celular. Muchos Android no dejan compartir `.json`, así que se prueba primero `.json` y después el mismo contenido como `.txt`; importar acepta los dos. Si el navegador no comparte archivos, se descarga.
- La fecha del último respaldo se anota recién cuando el archivo salió de la app (descarga o compartir confirmado), para que cancelar no apague el aviso de "sin respaldo".

## Borrador del formulario

- Lo que se carga en el formulario se guarda como borrador (tabla `ajustes`, clave `borrador:<id>`, o `borrador:nueva`) mientras no se toque "Guardar": con una pausa corta al escribir, al ocultarse la página (abrir la cámara, cambiar de app) y al salir de la pantalla. Así no se pierde si Android recarga la app al volver de la cámara.
- Al reabrir el formulario se recupera el borrador y se avisa, con la opción de descartarlo. Guardar o eliminar la crisis lo borra.
- Un borrador no es una crisis: no cuenta en estadísticas ni viaja en el respaldo. La limpieza de archivos huérfanos conserva las fotos de una crisis con borrador pendiente.

## Riesgos conocidos

- **El navegador puede borrar los datos** si falta espacio; en iPhone, también si la app no está instalada en la pantalla de inicio y no se usa por un tiempo. Se pide almacenamiento persistente al arrancar y el inicio avisa si pasaron más de 30 días sin respaldo.
- **Los datos en el celular no están cifrados por la app.** La protección es el bloqueo del celular. El respaldo se puede proteger con contraseña, pero es opcional; el CSV y el PDF nunca van cifrados.
- **Probado en un celular real solo en Android** (Oppo, Chrome): instalación, uso sin conexión, cámara y compartir PDF. Falta iPhone.
- **Quedan avisos de `npm audit` de severidad baja y moderada** en dependencias que solo se usan al compilar (las de Workbox). No llegan a la app publicada.

## Tratamiento preventivo y stock

- **Planes inmutables.** Un plan (`planes`) dice qué se toma, a qué horas y cada cuántos días. No se edita: si cambia la indicación se termina (`hasta`) y se crea otro. Así la adherencia de los meses anteriores se sigue calculando con lo que regía entonces.
- **Una toma es una fila con id fijo** (`planId|fecha|horario`): marcarla dos veces no duplica y desmarcarla es borrarla. La adherencia cuenta solo las tomas cuya hora ya pasó.
- **Sin notificaciones.** Una PWA sin servidor no puede programar avisos confiables con la app cerrada, así que las tomas del día se muestran en el inicio. La app recuerda lo que la persona cargó; no indica tratamientos.
- **Stock opcional por medicamento** (`stock`, `stockMinimo`, `vencimiento`). Al guardar una crisis se descuenta una unidad por cada dosis nueva de un medicamento con stock (`guardarCrisis` compara con la versión guardada); quitar una dosis no la devuelve. El inicio avisa por stock bajo, sin stock, vencido o por vencer en 30 días.
- Las tablas nuevas entraron con `version(2)` de Dexie, sin `upgrade` porque no tocan las existentes. `db/migracion.test.ts` verifica que una base de la versión 1 se abra sin perder datos.

## Evolución de la crisis

- `Crisis.evolucion` es una lista opcional de momentos (hora, gravedad, nota). Es opcional y no está indexada, así que no necesitó migración; las crisis anteriores no la tienen.
- En el PDF va en la columna "Evolución y notas" (solo si se incluyen las notas) y en el CSV en su propia columna.

## Interfaz

- **Modo oscuro por variables CSS** (`tailwind.config.cjs`). Los colores de Tailwind que usa la app salen de variables; en oscuro cada escala se invierte (50 pasa a 950, etc.), con ajustes en los grises para distinguir fondo, tarjeta y barras. Así no hay variantes `dark:` en los componentes. `white` es la superficie de tarjetas y el texto sobre colores fuertes, por eso también se invierte; donde hace falta blanco real se usa `text-[#fff]`.
- El tema sigue al sistema o se fuerza desde Ajustes. La elección vive en `localStorage` (preferencia del dispositivo, no dato) y la aplica un script en `index.html` antes de dibujar.
- **Actualizaciones con aviso.** El service worker se registra en modo `prompt`: cuando hay una versión nueva aparece un cartel con "Actualizar". Ajustes muestra la versión y la fecha de compilación.
- **Límite de errores** (`ui/ErrorBoundary`): si una pantalla falla, se muestra un mensaje en vez de la página en blanco.
- **Bienvenida** la primera vez (sin crisis y sin haberla visto), marcada con el ajuste `bienvenidaVista`.

## Estadísticas: días sin crisis

- "Días con crisis" cuenta toda crisis activa ese día, aunque haya empezado antes del período. Es la única estadística que no usa la regla "una crisis pertenece al período en que empezó".
- La comparación con el período anterior solo se muestra si ya se registraban crisis entonces, y describe la diferencia sin calificarla.

## Herramientas

- Vite 8, Vitest 5, TypeScript 7, vite-plugin-pwa 2 y Node 22 o superior. El proyecto es de módulos ES (`"type": "module"`); las configuraciones de Tailwind y PostCSS siguen en CommonJS, por eso llevan extensión `.cjs`.
- Tailwind se queda en la versión 3 y React en la 18: pasar a las siguientes es una migración aparte y no aporta nada a la app por ahora.

## Para más adelante

- **Escalas AAS, AECT y AE-QoL:** AECT y AE-QoL son cuestionarios con licencia; se podrían registrar los puntajes, no las preguntas. Tablas nuevas, sin tocar `Crisis`.
- **Notificaciones de las tomas:** harían falta un servidor de avisos push o una app nativa.
- **Varios pacientes y sincronización:** son datos sensibles según la Ley 18.331. Antes de guardar datos de otras personas en un servidor hacen falta consentimiento informado, cifrado en tránsito y en reposo, control de acceso y registro de la base ante la URCDP. Conviene asesorarse antes de diseñar esa parte.
