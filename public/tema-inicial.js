// Aplica el tema elegido en Ajustes antes de dibujar, para que no parpadee (ver src/ui/tema.ts).
// Lo carga index.html como script común, antes que la app.
try {
  var t = localStorage.getItem('aeh-tema');
  if (t === 'claro' || t === 'oscuro') {
    document.documentElement.setAttribute('data-tema', t);
    var c = t === 'oscuro' ? '#0f172a' : '#0f766e';
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.content = c;
    });
  }
} catch (e) {}
