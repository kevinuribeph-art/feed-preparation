// arranque.js · 1.2 · abre la Mesa (antes, un <script> en línea de index.html; D-252: la CSP solo deja correr archivos).
// 1.1: antes, la entrada (entrada.js, D-262): contraseña, el código de la app o el alta; después, la pantalla de carga mientras
// baja la Mesa y se dibuja.
(function () {
  if (window.MESA_A_MOVIL) return;   // un iPhone va a movil.html (tema.js, D-269): aquí no se abre nada
  var M = window.MESA, E = M && M.entrada;
  if (!M || !M.boot) { document.body.textContent = 'No se pudo cargar mesa.js. Recarga la página.'; return; }
  (E ? E.abrir() : Promise.resolve())
    .then(function () { if (E) E.cargaDurante(); return M.boot(); })
    .then(function () { if (E) E.cargaFin(); }, function (e) { if (E) E.cargaFin(); document.body.textContent = 'No se pudo abrir la mesa: ' + e; });
})();
