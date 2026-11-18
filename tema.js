// tema.js · 1.0 · el tema oscuro antes de pintar (D-132, D-252): antes era un <script> en línea de index.html; la CSP de la
// Mesa (script-src 'self') ya no los deja correr. Se carga sin async en el <head>, así sigue sin destello claro al abrir en oscuro.
try { if (localStorage.getItem('mesa-tema') === 'oscuro') { document.documentElement.dataset.theme = 'dark'; var st = document.createElement('style'); st.textContent = 'body{background:#15110E !important;color:#F1EBE3 !important;color-scheme:dark}'; document.head.appendChild(st); } } catch (e) { /* light */ }
