// tema.js · 1.1 · el tema oscuro antes de pintar (D-132, D-252) y, en un iPhone, la Mesa del móvil (D-269).
// 1.1: abierta en un iPhone (no en un iPad, que dice ser un Mac, ni en el Mac), la dirección de siempre lleva a movil.html antes de que
// nada abra IndexedDB o pida la Mesa: la marca MESA_A_MOVIL para mesa.js y arranque.js; la decisión, en MESA_MOVIL_UA (la prueba la mira).
window.MESA_MOVIL_UA = function (ua) { return /\b(iPhone|iPod)\b/.test(String(ua || '')); };
if (window.MESA_MOVIL_UA(navigator.userAgent)) { window.MESA_A_MOVIL = true; try { location.replace('movil.html' + location.hash); } catch (e) { /* */ } }
try { if (localStorage.getItem('mesa-tema') === 'oscuro') { document.documentElement.dataset.theme = 'dark'; var st = document.createElement('style'); st.textContent = 'body{background:#15110E !important;color:#F1EBE3 !important;color-scheme:dark}'; document.head.appendChild(st); } } catch (e) { /* light */ }
