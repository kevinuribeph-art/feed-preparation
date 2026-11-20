// vigia.js · 1.1 · el vigilante de los módulos (D-115) y de la CSP (D-252). Antes era un <script> en línea de index.html más
// un `onerror=` en cada <script>; la CSP de la Mesa (script-src 'self') no deja correr ni lo uno ni lo otro.
(function () {
  'use strict';
  var C = function () { return (window.MESA_CARGA = window.MESA_CARGA || {}); };
  // un módulo que llega pero lanza mientras se ejecuta es «fallo», como uno que no llega (D-115): cada uno dice «ok» al final
  var CORRE = /\/(?:kits\/)?(motor|diseno|libre|calendario|revisar|historias|carpetas|descargar|controles|personal|escritura|sesiones|cobros|informe|web|copia|nube|movil)\.js(?:\?|$)/;
  // uno que no llega: el error de su <script>, que no sube, se oye aquí en la captura (era su `onerror=`)
  var LLEGA = /\/(?:kits\/|portal\/)?(motor|diseno|libre|calendario|revisar|historias|carpetas|descargar|controles|personal|escritura|sesiones|cobros|informe|web|copia|supa|nube|movil)\.js(?:\?|$)/;
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && t.tagName === 'SCRIPT') {
      var m = LLEGA.exec(t.src || ''); if (!m) return;
      C()[m[1]] = 'fallo';
      if (m[1] === 'calendario') { try { MESA._in.trayFold(); } catch (x) { /* la mesa aún no tiene su armazón */ } }
      return;
    }
    var r = CORRE.exec(e.filename || '');
    if (r && C()[r[1]] !== 'ok') C()[r[1]] = 'fallo';
  }, true);
  // lo que la CSP bloquea queda a la vista (no hay a dónde mandarlo desde un <meta>): en MESA_CSP y en un aviso de la Mesa
  document.addEventListener('securitypolicyviolation', function (e) {
    var l = (window.MESA_CSP = window.MESA_CSP || []), u = String(e.blockedURI || '');
    l.push({ d: e.effectiveDirective || e.violatedDirective, u: u, f: e.sourceFile || '', l: e.lineNumber || 0 });
    var host = /^https?:/.test(u) ? u.split('/')[2] : u || 'código en línea';
    try { MESA._in.toast('La seguridad de la Mesa ha bloqueado ' + host + ' (' + (e.effectiveDirective || '') + '). Díselo a Claude.', { error: true }); } catch (x) { /* sin armazón todavía */ }
  });
})();
