// arranque.js · 1.0 · abre la Mesa (antes, un <script> en línea de index.html; D-252: la CSP solo deja correr archivos).
window.MESA && MESA.boot ? MESA.boot().catch(function (e) { document.body.textContent = 'No se pudo abrir la mesa: ' + e; })
                         : (document.body.textContent = 'No se pudo cargar mesa.js. Recarga la página.');
