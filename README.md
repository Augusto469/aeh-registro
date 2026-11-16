# Registro de crisis de AEH

App personal para registrar crisis de angioedema hereditario y compartir un resumen con el médico.

- Es una PWA: se instala en el celular y funciona sin conexión.
- Los datos se guardan solo en el dispositivo (IndexedDB). No hay servidor.
- Solo registra datos. No da recomendaciones médicas.

## Qué hace

- **Registro rápido:** zona, gravedad y guardar. Queda "en curso" y se completa después.
- **Formulario completo:** fechas (o solo el día, para crisis pasadas), zonas, gravedad, síntomas previos, desencadenantes, medicación de rescate, atención médica, días perdidos, evolución, notas, fotos y videos.
- **Historial:** lista con filtros y calendario.
- **Estadísticas:** crisis por mes, zonas, desencadenantes, síntomas previos, uso de medicación, días sin crisis y comparación con el período anterior.
- **Medicación:** stock y vencimiento de la medicación de rescate, y tratamiento preventivo con las tomas del día y su cumplimiento.
- **Informe:** PDF de un período, con resumen, gráfico, tablas y detalle; fotos y notas opcionales.
- **Respaldo:** compartir, descargar e importar (con o sin fotos y videos, con contraseña opcional) y exportar CSV.
- **Borrador automático:** lo que se carga en el formulario no se pierde si se sale sin guardar.
- **Modo oscuro**, aviso cuando hay una versión nueva e introducción la primera vez.

## Cómo usarla en desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # tests de dominio y repositorio
npm run build    # verifica tipos y genera dist/
```

Necesita Node 22 o superior.

## Estructura

```
src/
  domain/     lógica pura y testeada: tipos, fechas, estadísticas, informe, CSV, respaldo, cifrado, profilaxis, medicación
  db/         esquema Dexie (db.ts) y repositorio (repo.ts): lo único que toca IndexedDB
  features/   una carpeta por pantalla: inicio, crisis, historial, estadisticas, informe, medicacion, ajustes
  ui/         componentes compartidos
  app/        rutas y barra de navegación
```

Las decisiones técnicas y lo que queda pendiente están en [docs/decisiones.md](docs/decisiones.md).

## Publicación

`.github/workflows/deploy.yml` corre los tests, compila y publica en GitHub Pages con cada push a `main`. Necesita **Settings > Pages > Source: GitHub Actions** y, con la cuenta gratuita, que el repositorio sea público.

La app queda en <https://augusto469.github.io/aeh-registro/>. Para instalarla en el celular se abre esa dirección una vez (Chrome en Android, Safari en iPhone) y se elige "Instalar app" o "Agregar a inicio"; después funciona sin conexión.

## Privacidad

El código no contiene datos de salud. Los registros viven en el navegador de cada dispositivo. El respaldo se puede proteger con contraseña; sin ella, cualquiera que tenga el archivo puede leerlo, así que hay que guardarlo en un lugar privado.
