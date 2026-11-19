// entrada.js · 1.0 · la entrada de la Mesa (D-262): correo y contraseña en cada ventana o pestaña nueva, el código de la app
// (TOTP, Contraseñas de Apple) la primera vez en cada ordenador y a los 30 días, el alta (contraseña y QR), «¿Olvidaste tu
// contraseña?» y la pantalla de carga mientras baja la Mesa. Sin proyecto (las copias de 127.0.0.1, la batería) no hace nada.
// La sesión del servidor se guarda en este navegador cifrada con la contraseña (PBKDF2 SHA-256 de 1.000.000 vueltas y
// AES-GCM): localStorage['mesa-entrada-<ref>']. Cada pestaña abierta guarda, solo para ella, la sesión y la llave que la abre
// (sessionStorage): recargar no la pide, una pestaña nueva sí, y una pestaña recargada vuelve a cifrar lo renovado.
// Va antes que nube.js (la nube crea la sesión al cargar) y sin async: decide al cargar dónde vive la sesión.
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var V = '1.0', VUELTAS = 1000000, DIA = 86400000, VALE = 30, AVISA = 29;

  // ================= el núcleo (sin DOM): cifrado, la sesión guardada y qué pedir =================
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function deb64(t) { var s = atob(String(t || '')), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function azar(n) { return G.crypto.getRandomValues(new Uint8Array(n)); }
  function llaveDe(contrasena, sal, vueltas) {
    var S = G.crypto.subtle;
    return S.importKey('raw', enc.encode(String(contrasena)), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) { return S.deriveBits({ name: 'PBKDF2', salt: sal, iterations: vueltas, hash: 'SHA-256' }, k, 256); })
      .then(function (b) { return new Uint8Array(b); });
  }
  function aes(raw, uso) { return G.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [uso]); }
  function cifrar(raw, obj) {
    var iv = azar(12);
    return aes(raw, 'encrypt').then(function (k) { return G.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(obj))); })
      .then(function (c) { return { iv: b64(iv), dato: b64(new Uint8Array(c)) }; });
  }
  function descifrar(raw, iv, dato) {
    return aes(raw, 'decrypt').then(function (k) { return G.crypto.subtle.decrypt({ name: 'AES-GCM', iv: deb64(iv) }, k, deb64(dato)); })
      .then(function (p) { return JSON.parse(dec.decode(p)); });
  }
  // ¿Hay que pedir el código? Sin sesión `aal2`, sin la hora del código o a los 29 días de él (un día de margen: que no caduque a
  // mitad del trabajo). Quien decide de verdad es el servidor (30 días); esto solo evita que caduque con la Mesa abierta.
  function pideCodigo(nivel, ahora) {
    return !nivel || nivel.aal !== 'aal2' || !nivel.totp || ahora >= nivel.totp * 1000 + AVISA * DIA;
  }
  function venceCodigo(nivel) { return nivel && nivel.totp ? nivel.totp * 1000 + VALE * DIA : 0; }
  // Lo que dice un token (sin comprobar su firma: solo para decidir qué pedir).
  function nivelDe(tk) {
    try { var b = String(tk).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), c = JSON.parse(dec.decode(deb64(b + '==='.slice((b.length + 3) % 4)))), t = null;
      (Array.isArray(c.amr) ? c.amr : []).forEach(function (e) { if (e && e.method === 'totp' && +e.timestamp > (t || 0)) t = +e.timestamp; });
      return { aal: c.aal || 'aal1', totp: t }; } catch (e) { return null; }
  }

  // La sesión guardada, cifrada (el `almacen` de supa.js 1.3). ls/ss: localStorage y sessionStorage (o sus dobles en las pruebas).
  function almacenCifrado(o) {
    var ls = o.ls, ss = o.ss, BLOB = 'mesa-entrada-' + o.ref, SES = 'mesa-sesion-' + o.ref, LLAVE = 'mesa-llave-' + o.ref;
    var oyente = null, cadena = Promise.resolve(), escritos = 0, ultimaT = 0;   // ultimaT: la guardada más nueva aplicada aquí (los eventos pueden llegar desordenados)
    function jl(st, k) { try { var t = st.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
    function js(st, k, v) { try { if (v == null) st.removeItem(k); else st.setItem(k, JSON.stringify(v)); } catch (e) { /* lleno o sin almacenamiento */ } }
    function llave() { var l = jl(ss, LLAVE); return l && l.raw ? { raw: deb64(l.raw), sal: l.sal, it: l.it } : null; }
    function escribir(s) {
      var l = llave(); if (!l || !s || !s.user) return Promise.resolve(false);
      return cifrar(l.raw, s).then(function (c) {
        var b = jl(ls, BLOB);
        if (b && b.sal && b.sal !== l.sal) return false;   // otra entrada en este navegador (otra sal): esta pestaña ya no escribe encima
        var t = Math.max(Date.now(), ultimaT + 1); ultimaT = t;
        js(ls, BLOB, { v: 1, correo: s.user.email, uid: s.user.id, sal: l.sal, it: l.it, iv: c.iv, dato: c.dato, t: t, vence: venceCodigo(nivelDe(s.access_token)) || 0 });
        var b2 = jl(ls, BLOB); if (!b2 || b2.iv !== c.iv) throw new Error('este navegador no deja guardar la sesión (¿almacenamiento lleno o bloqueado?)');
        escritos++; return true;
      });
    }
    var A = {
      leer: function () { return jl(ss, SES); },
      guardar: function (s) {
        if (s) { js(ss, SES, s); cadena = cadena.then(function () { return escribir(s); }).catch(function () { return false; }); }
        else {   // la sesión ya no vale (anulada, o «Otra cuenta»): la guardada tampoco, si es la de esta pestaña (una entrada más nueva tiene otra sal)
          var l = llave(), b = jl(ls, BLOB);
          js(ss, SES, null); js(ss, LLAVE, null);
          if (b && (!l || b.sal === l.sal)) js(ls, BLOB, null);
        }
      },
      oir: function (f) {
        oyente = f;
        try {
          G.addEventListener('storage', function (e) {
            if (e.key !== BLOB) return;
            var l = llave(); if (!l) return;   // una pestaña sin abrir no mira nada
            if (!e.newValue) { js(ss, SES, null); js(ss, LLAVE, null); if (oyente) oyente(null); return; }
            var b = null; try { b = JSON.parse(e.newValue); } catch (x) { return; }
            if (!b || b.sal !== l.sal) { js(ss, SES, null); js(ss, LLAVE, null); if (oyente) oyente(null); return; }   // otra entrada: esta pestaña vuelve a pedirla
            var t = +b.t || 0;
            descifrar(l.raw, b.iv, b.dato).then(function (s) { if (t < ultimaT) return; ultimaT = t; js(ss, SES, s); if (oyente) oyente(s); }, function () { /* a medio escribir: llegará otra */ });
          });
        } catch (e) { /* sin ventana (pruebas) */ }
      },
      // Lo que usa la entrada:
      guardada: function () { return jl(ls, BLOB); },
      abierta: function () { return !!llave() && !!jl(ss, SES); },
      poner: function (s) { js(ss, SES, s); if (oyente) oyente(s); },
      // Abrir la guardada con la contraseña (en este Mac, sin red). Lanza si la contraseña no la abre.
      desbloquear: function (contrasena) {
        var b = jl(ls, BLOB); if (!b) return Promise.reject(new Error('no hay sesión guardada'));
        var sal = deb64(b.sal);
        return llaveDe(contrasena, sal, b.it || VUELTAS).then(function (raw) {
          return descifrar(raw, b.iv, b.dato).then(function (s) { js(ss, LLAVE, { raw: b64(raw), sal: b.sal, it: b.it || VUELTAS }); A.poner(s); return s; });
        });
      },
      // Una entrada nueva (ordenador nuevo, contraseña nueva, alta): sal nueva, la llave en la pestaña y la sesión cifrada.
      nueva: function (contrasena, s) {
        var sal = azar(16);
        return llaveDe(contrasena, sal, VUELTAS).then(function (raw) {
          js(ss, LLAVE, { raw: b64(raw), sal: b64(sal), it: VUELTAS }); js(ls, BLOB, null); js(ss, SES, s);
          return escribir(s);
        });
      },
      // La pestaña recargada: la guardada manda (otra pestaña pudo renovarla mientras esta no miraba).
      sincronizar: function () {
        var l = llave(), b = jl(ls, BLOB);
        var olvidar = function () { js(ss, SES, null); js(ss, LLAVE, null); if (oyente) oyente(null); return false; };
        if (!l) return Promise.resolve(false);
        if (!b || b.sal !== l.sal) return Promise.resolve(olvidar());   // otra entrada en este navegador: esta pestaña vuelve a pedirla
        return descifrar(l.raw, b.iv, b.dato).then(function (s) { ultimaT = Math.max(ultimaT, +b.t || 0); A.poner(s); return true; }, olvidar);
      },
      esperar: function () { return cadena; },
      _escritos: function () { return escritos; },
      CLAVES: { BLOB: BLOB, SES: SES, LLAVE: LLAVE }
    };
    return A;
  }
  G.EntradaNucleo = { version: V, VUELTAS: VUELTAS, llaveDe: llaveDe, cifrar: cifrar, descifrar: descifrar, pideCodigo: pideCodigo, venceCodigo: venceCodigo, nivelDe: nivelDe, almacenCifrado: almacenCifrado, b64: b64, deb64: deb64 };

  // ================= la página =================
  var M = G.MESA, D = G.document;
  if (!M || !D || !M._in) return;
  var X = M._in;
  function lsG(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* */ } }
  var P = null; try { P = X.proyectoWeb && X.proyectoWeb(); } catch (e) { P = null; }
  var REF = P && P.url ? P.url.split('//')[1].split('.')[0] : '';
  var A = REF ? almacenCifrado({ ref: REF, ls: localStorage, ss: sessionStorage }) : null;
  // Dónde vive la sesión: cifrada si ya hubo entrada en este navegador; si solo está la de antes (en claro, la del código por
  // correo), como antes hasta hacer el alta (migrar); si nada, ordenador nuevo.
  var MODO = !REF ? 'sin_proyecto' : A.guardada() ? 'cifrado' : lsG('mesa-web-' + REF) ? 'migrar' : 'nuevo';
  if (MODO === 'cifrado') X.almacenSesion = A;
  var ACTIVA = 'mesa-nube', TRAER = 'mesa-nube-traer';
  var reducir = function () { try { return G.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var oscuro = function () { return D.documentElement.dataset.theme === 'dark'; };
  var fecha = function (ms) { try { return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }); } catch (e) { return ''; } };
  // Una instancia de Supa aparte, en memoria, para entrar: nunca toca la de la Mesa hasta que todo ha ido bien. Supa no da su
  // sesión entera; la entrada la lee de ese almacén en memoria para guardarla cifrada.
  function temporalCon() {
    var mem = null;
    var c = G.Supa.crear({ url: P.url, publica: P.publica, clave: 'mesa-entrada-tmp', almacen: { leer: function () { return null; }, guardar: function (s) { mem = s; }, oir: function () {} } });
    c._sesionEntera = function () { return mem; };
    return c;
  }

  // ---------- estilo (los tokens de la Mesa; D-131, D-132) ----------
  var CSS = '#mesa-entrada{--bg:#F4EFE8;--bg-2:#EDE6DC;--bg-3:#E4DBCE;--panel:#FBF9F6;--panel-2:#FFFFFF;--ink:#16110E;--ink-2:#4A4038;--mute:#6E635A;--faint:#A39A90;--line:#DDD4C8;--line-strong:#C7BCAE;--acc:#B2503A;--acc-ink:#A0472F;--acc-hover:#9B432F;--on-acc:#FFFFFF;--ring:rgba(178,80,58,.32);--red:#C42B3A;--paper:#F4EFE8;--shadow-md:0 6px 18px -6px rgba(22,17,14,.18),0 2px 6px rgba(22,17,14,.06);--font:"Mesa Grotesk",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif;--ease:cubic-bezier(.22,1,.36,1);'
    + 'position:fixed;inset:0;z-index:2147483000;background:var(--bg);color:var(--ink);font:13px/1.4 var(--font);-webkit-font-smoothing:antialiased;display:grid;place-items:center;overflow:auto;padding:40px 16px;transition:opacity .25s var(--ease)}'
    + ':root[data-theme="dark"] #mesa-entrada{--bg:#15110E;--bg-2:#29221D;--bg-3:#352D26;--panel:#1E1915;--panel-2:#2F2822;--ink:#F1EBE3;--ink-2:#D3C9BD;--mute:#A89C8F;--faint:#7A6F64;--line:#3D352E;--line-strong:#574C42;--acc-ink:#D9805F;--acc-hover:#C25A41;--ring:rgba(217,128,95,.42);--red:#F0727A;--shadow-md:0 6px 18px -6px rgba(0,0,0,.6),0 2px 6px rgba(0,0,0,.4)}'
    + '#mesa-entrada.fuera{opacity:0;pointer-events:none}#mesa-entrada *{box-sizing:border-box}'
    + '#mesa-entrada .col{width:min(380px,100%);display:flex;flex-direction:column}#mesa-entrada .col.ancha{width:min(640px,100%)}'
    + '#mesa-entrada .logo{height:44px;margin:0 0 44px;align-self:flex-start}#mesa-entrada .logo img{height:100%;display:block}'
    + '#mesa-entrada h1{margin:0;font:800 26px/1.12 var(--font);letter-spacing:-.022em}'
    + '#mesa-entrada .dato{margin:7px 0 0;font:600 13px/1.4 var(--font);color:var(--acc-ink)}'
    + '#mesa-entrada .p{margin:16px 0 0;font:400 14px/1.5 var(--font);color:var(--ink-2);max-width:52ch}#mesa-entrada .p b{font-weight:600;color:var(--ink)}'
    + '#mesa-entrada form{margin:26px 0 0;display:flex;flex-direction:column}'
    + '#mesa-entrada label{font:600 12px/1.3 var(--font);color:var(--mute);margin:0 0 7px}'
    + '#mesa-entrada .lrow{display:flex;justify-content:space-between;align-items:baseline;gap:12px}'
    + '#mesa-entrada .campo{position:relative;margin:0 0 16px}'
    + '#mesa-entrada input{width:100%;height:44px;padding:0 13px;border:1px solid var(--line-strong);border-radius:8px;background:var(--panel-2);color:var(--ink);font:400 15px/1 var(--font);outline:none}'
    + '#mesa-entrada input:focus-visible,#mesa-entrada input:focus{border-color:var(--acc);box-shadow:0 0 0 3px var(--ring)}'
    + '#mesa-entrada input.cod{height:58px;text-align:center;font:600 28px/1 var(--font);letter-spacing:.42em;padding-left:.42em;font-variant-numeric:tabular-nums}'
    + '#mesa-entrada input.cod::placeholder{color:var(--line-strong)}'
    + '#mesa-entrada .ojo{position:absolute;right:6px;top:6px;width:32px;height:32px;border:0;background:transparent;border-radius:6px;display:grid;place-items:center;color:var(--mute);cursor:pointer}#mesa-entrada .ojo svg{width:18px;height:18px}'
    + '#mesa-entrada .err{margin:-6px 0 12px;font:500 13px/1.4 var(--font);color:var(--red)}#mesa-entrada .err:empty{display:none}'
    + '#mesa-entrada .btn{height:44px;width:100%;border:0;border-radius:8px;background:var(--acc);color:var(--on-acc);font:600 14.5px/1 var(--font);margin-top:6px;cursor:pointer}#mesa-entrada .btn:hover{background:var(--acc-hover)}#mesa-entrada .btn:disabled{opacity:.6;cursor:default}'
    + '#mesa-entrada .btn2{height:44px;width:100%;border:1px solid var(--line-strong);border-radius:8px;background:transparent;color:var(--ink);font:500 14px/1 var(--font);margin-top:10px;cursor:pointer}'
    + '#mesa-entrada .nota{margin:14px 0 0;font:400 12.5px/1.45 var(--font);color:var(--mute)}#mesa-entrada .nota b{font-weight:600;color:var(--ink-2)}'
    + '#mesa-entrada .enlace{margin:26px 0 0;padding:16px 0 0;border-top:1px solid var(--line);font:400 13px/1.45 var(--font);color:var(--mute)}'
    + '#mesa-entrada a,#mesa-entrada .lnk{color:var(--ink);text-decoration:underline;text-decoration-color:var(--line-strong);text-underline-offset:3px;font:inherit;font-weight:500;background:none;border:0;padding:0;cursor:pointer}'
    + '#mesa-entrada .lrow .lnk{font:500 12.5px/1.3 var(--font);color:var(--ink-2)}'
    + '#mesa-entrada .cuenta{display:flex;align-items:center;gap:11px;height:52px;padding:0 6px 0 9px;border:1px solid var(--line);border-radius:10px;background:var(--panel);margin:0 0 18px}'
    + '#mesa-entrada .cuenta .ini{width:32px;height:32px;border-radius:50%;background:var(--ink);color:var(--paper);display:grid;place-items:center;font:800 13px/1 var(--font);text-transform:uppercase}'
    + ':root[data-theme="dark"] #mesa-entrada .cuenta .ini{background:var(--bg-3);color:var(--ink)}'
    + '#mesa-entrada .cuenta .mail{flex:1;min-width:0;font:500 14px/1.2 var(--font);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '#mesa-entrada .cuenta .lnk{color:var(--mute);font-size:12.5px;text-decoration:none;padding:8px}'
    + '#mesa-entrada .alta{display:grid;grid-template-columns:212px 1fr;gap:28px;margin:28px 0 0;align-items:start}'
    + '#mesa-entrada .qr{width:212px;height:212px;padding:10px;border-radius:12px;background:#FFFFFF;border:1px solid var(--line);box-shadow:var(--shadow-md)}#mesa-entrada .qr img{width:100%;height:100%;display:block;image-rendering:pixelated}'
    + '#mesa-entrada ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:16px;counter-reset:p}'
    + '#mesa-entrada ol li{counter-increment:p;display:grid;grid-template-columns:24px 1fr;gap:10px;font:400 13.5px/1.5 var(--font);color:var(--ink-2)}'
    + '#mesa-entrada ol li::before{content:counter(p);width:22px;height:22px;border-radius:50%;border:1px solid var(--line-strong);display:grid;place-items:center;font:600 11.5px/1 var(--font);color:var(--ink);margin-top:1px}#mesa-entrada ol b{font-weight:600;color:var(--ink)}'
    + '#mesa-entrada .clave{display:flex;align-items:center;gap:8px;margin-top:8px;padding:8px 8px 8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}'
    + '#mesa-entrada .clave code{flex:1;font:500 13px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;color:var(--ink);word-spacing:.18em;user-select:all}'
    + '#mesa-entrada .clave button{height:28px;padding:0 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--panel-2);color:var(--ink);font:500 12px/1 var(--font);cursor:pointer}'
    + '@media (max-width:760px){#mesa-entrada{place-items:start center;padding-top:56px}#mesa-entrada .alta{grid-template-columns:1fr;gap:22px}#mesa-entrada .qr{justify-self:center}}'
    + '#mesa-entrada.carga{place-items:center}#mesa-entrada .cb{display:flex;flex-direction:column;align-items:center}'
    + '#mesa-entrada .mono{position:relative;width:104px;height:104px}#mesa-entrada .mono svg{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '#mesa-entrada .mono .ll{position:absolute;inset:0;clip-path:inset(100% 0 0 0);transition:clip-path .24s var(--ease)}'
    + '#mesa-entrada .marca{margin:22px 0 0;font:800 15px/1 var(--font);letter-spacing:-.01em}'
    + '#mesa-entrada .avance{margin:8px 0 0;font:500 13px/1.3 var(--font);color:var(--ink-2);min-height:1.3em}#mesa-entrada .avance span{color:var(--mute)}'
    + '@media (prefers-reduced-motion:reduce){#mesa-entrada,#mesa-entrada .mono .ll{transition:none}}';
  function estilo() { if (D.getElementById('mesa-entrada-css')) return; var s = D.createElement('style'); s.id = 'mesa-entrada-css'; s.textContent = CSS; D.head.appendChild(s); }
  var U = 'M49.99 66.38Q45.49 66.38 42.32 64.89Q39.14 63.4 37.47 60.55Q35.8 57.7 35.8 53.64V34.22H43.72V53.46Q43.72 56.49 45.32 58.07Q46.92 59.65 49.99 59.65Q53.08 59.65 54.68 58.01Q56.28 56.38 56.28 52.98V34.22H64.2V53.64Q64.2 57.7 62.53 60.55Q60.86 63.4 57.7 64.89Q54.53 66.38 49.99 66.38Z';
  var OJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle vector-effect="non-scaling-stroke" cx="12" cy="12" r="3"/></svg>';

  // ---------- la capa ----------
  var capaEl = null;
  function capa(html, clase) {
    estilo();
    if (!capaEl || !capaEl.isConnected) { capaEl = D.createElement('div'); capaEl.id = 'mesa-entrada'; capaEl.setAttribute('role', 'main'); D.body.appendChild(capaEl); }
    capaEl.className = clase || ''; capaEl.innerHTML = html;
    var f = capaEl.querySelector('[data-foco]') || capaEl.querySelector('input:not([type=hidden])'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* */ } }
    return capaEl;
  }
  function quitar() { if (capaEl) { capaEl.remove(); capaEl = null; } }
  var logo = function () { return '<div class="logo"><img src="portal/marca/' + (oscuro() ? 'logo-paper' : 'logo-ink') + '.svg" alt="Uribe Visuals"></div>'; };
  var cab = function (t, dato) { return logo() + '<h1>' + t + '</h1>' + (dato ? '<p class="dato">' + dato + '</p>' : ''); };
  var pw = function (id, nueva) { return '<div class="campo"><input id="' + id + '" name="' + id + '" type="password" autocomplete="' + (nueva ? 'new-password' : 'current-password') + '" required' + (nueva ? ' minlength="20"' : '') + '><button type="button" class="ojo" data-ver="' + id + '" aria-label="Ver la contraseña">' + OJO + '</button></div>'; };
  var cod = function (id, etq) { return '<label for="' + id + '">' + etq + '</label><div class="campo"><input id="' + id + '" name="' + id + '" class="cod" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" required></div>'; };
  var err = '<p class="err" role="alert" aria-live="assertive"></p>';
  // Los formularios de la capa: resuelve con sus campos o con la acción del botón pulsado. `siguiente()` espera otro envío sin
  // volver a dibujar (el error se queda a la vista y lo escrito también).
  function enlazar(c, res) {
    c.onsubmit = function (e) { e.preventDefault(); var f = e.target, d = {}; Array.prototype.forEach.call(f.elements, function (x) { if (x.name) d[x.name] = x.value; }); res({ envio: d, form: f }); };
    c.onclick = function (e) {
      var v = e.target.closest && e.target.closest('[data-ver]');
      if (v) { var i = D.getElementById(v.dataset.ver); if (i) { i.type = i.type === 'password' ? 'text' : 'password'; v.setAttribute('aria-label', i.type === 'password' ? 'Ver la contraseña' : 'Ocultar la contraseña'); } return; }
      var cp = e.target.closest && e.target.closest('[data-copiar]');
      if (cp) { try { G.navigator.clipboard.writeText(cp.dataset.copiar.replace(/\s/g, '')); cp.textContent = 'Copiada'; } catch (x) { /* */ } return; }
      var a = e.target.closest && e.target.closest('[data-accion]'); if (a) { e.preventDefault(); res({ accion: a.dataset.accion }); }
    };
  }
  function esperar(html, clase) { return new Promise(function (res) { enlazar(capa(html, clase), res); }); }
  function siguiente() { return new Promise(function (res) { enlazar(capaEl, res); }); }
  function fallo(form, texto) { var p = form && form.querySelector('.err'); if (p) p.textContent = texto; var b = form && form.querySelector('[type=submit]'); if (b) b.disabled = false; }
  function ocupado(form, si) { var b = form && form.querySelector('[type=submit]'); if (b) b.disabled = !!si; }
  var red = function (e) { return e && (e.status === 0 || e.codigo === 'red'); };
  var mensaje = function (e) { return red(e) ? 'Sin conexión: inténtalo cuando vuelva.' : (e && e.message ? e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.' : 'No se pudo: inténtalo otra vez.'); };

  // ---------- las pantallas ----------
  var PANT = {
    entrar: function (o) { return '<div class="col">' + cab('Tu Mesa') + '<form novalidate><div class="cuenta"><span class="ini">' + esc((o.correo || '?').charAt(0)) + '</span><span class="mail">' + esc(o.correo) + '</span><button type="button" class="lnk" data-accion="otra">Otra cuenta</button></div>'
      + '<input type="email" name="correo" value="' + esc(o.correo) + '" autocomplete="username" hidden><div class="lrow"><label for="e-pw">Contraseña</label><button type="button" class="lnk" data-accion="olvido">¿Olvidaste tu contraseña?</button></div>' + pw('e-pw') + err
      + '<button class="btn" type="submit">Entrar</button></form>' + (o.vence ? '<p class="nota">Este navegador te pedirá el código de tu app el <b>' + esc(fecha(o.vence)) + '</b>.</p>' : '') + '</div>'; },
    nuevo: function (o) { return '<div class="col">' + cab('Tu Mesa', o.aviso ? esc(o.aviso) : 'Ordenador nuevo') + '<form novalidate><label for="e-co">Correo</label><div class="campo"><input id="e-co" name="correo" type="email" autocomplete="username" value="' + esc(o.correo || '') + '" required' + (o.correo ? '' : ' data-foco') + '></div>'
      + '<div class="lrow"><label for="e-pw">Contraseña</label><button type="button" class="lnk" data-accion="olvido">¿Olvidaste tu contraseña?</button></div>' + pw('e-pw') + err + '<button class="btn" type="submit">Entrar</button></form>'
      + '<p class="enlace">¿Primera vez, o sin contraseña? <button type="button" class="lnk" data-accion="primera">Entra con un código por correo</button></p></div>'; },
    correo: function (o) { return '<div class="col">' + cab(o.titulo || 'Mira tu correo', o.dato || '') + '<p class="p">Te hemos mandado un código de 6 cifras a <b>' + esc(o.correo) + '</b>. Vale 10 minutos.</p><form novalidate>' + cod('e-cc', 'Código del correo') + err
      + '<button class="btn" type="submit">Seguir</button></form><p class="enlace">¿No llega? Mira en spam o <button type="button" class="lnk" data-accion="otro">pide otro</button> dentro de un minuto. <button type="button" class="lnk" data-accion="volver">Volver</button></p></div>'; },
    pedirCorreo: function (o) { return '<div class="col">' + cab(o.titulo, o.dato || '') + '<p class="p">Te mandamos un código de 6 cifras a tu correo.</p><form novalidate><label for="e-co">Correo</label><div class="campo"><input id="e-co" name="correo" type="email" autocomplete="username" value="' + esc(o.correo || '') + '" required></div>' + err
      + '<button class="btn" type="submit">Enviarme el código</button></form><p class="enlace"><button type="button" class="lnk" data-accion="volver">Volver</button></p></div>'; },
    codigo: function (o) { return '<div class="col">' + cab(o.titulo || 'Código de tu app', o.dato || 'Contraseñas · Mesa Uribe Visuals') + '<p class="p">' + (o.texto || 'Ábrelo en <b>Contraseñas</b>, en el iPhone o en el Mac, y escribe las 6 cifras.') + '</p><form novalidate>' + cod('e-cod', 'Código') + err
      + '<button class="btn" type="submit">' + (o.boton || 'Entrar') + '</button></form>' + (o.nota ? '<p class="nota">' + o.nota + '</p>' : '') + (o.ayuda ? '<p class="enlace">' + o.ayuda + '</p>' : '') + '</div>'; },
    contrasena: function (o) { return '<div class="col">' + cab(o.titulo, o.dato) + '<p class="p">Créala en <b>Contraseñas</b> (sitio <b>' + esc(location.host) + '</b>) y pégala aquí. Al menos 20 caracteres.</p><form novalidate><input type="email" name="correo" value="' + esc(o.correo || '') + '" autocomplete="username" hidden>'
      + '<label for="e-n1">Contraseña nueva</label>' + pw('e-n1', true) + '<label for="e-n2">Repítela</label>' + pw('e-n2', true) + err + '<button class="btn" type="submit">' + (o.boton || 'Seguir') + '</button>'
      + (o.ahoraNo ? '<button class="btn2" type="button" data-accion="ahora-no">Ahora no</button>' : '') + '</form>' + (o.nota ? '<p class="nota">' + o.nota + '</p>' : '') + '</div>'; },
    qr: function (o) { var k = String(o.clave || '').replace(/(.{4})/g, '$1 ').trim();
      return '<div class="col ancha">' + cab('Añade tu código a Contraseñas', 'Paso 2 de 2 · unos 2 minutos') + '<div class="alta"><div class="qr"><img alt="Código QR para Contraseñas" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(o.qr || '') + '"></div><div><ol>'
      + '<li><span>En el iPhone, abre <b>Contraseñas</b>, entra en <b>' + esc(location.host) + '</b> y pulsa <b>Configurar código de verificación → Escanear código QR</b>.</span></li>'
      + '<li><span>O en el Mac, pega esta clave en el mismo sitio:<span class="clave"><code>' + esc(k) + '</code><button type="button" data-copiar="' + esc(k) + '">Copiar</button></span></span></li>'
      + '<li><span>Escribe el código que te da para comprobar que funciona.</span></li></ol><form novalidate><div class="campo"><input name="e-cod" class="cod" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" aria-label="Código" required data-foco></div>' + err
      + '<button class="btn" type="submit">Activar y entrar</button></form></div></div></div>'; },
    mensaje: function (o) { return '<div class="col">' + cab(o.titulo, o.dato || '') + '<p class="p">' + o.texto + '</p>' + (o.boton ? '<form novalidate><button class="btn" type="submit">' + o.boton + '</button></form>' : '') + '</div>'; },
    carga: function () { var vac = oscuro() ? ['#352D26', '#7A6F64'] : ['#E4DBCE', '#A39A90'];
      var sq = function (f, l) { return '<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="' + f + '"/><path fill="' + l + '" d="' + U + '"/></svg>'; };
      return '<div class="cb" role="status" aria-live="polite"><div class="mono" role="img" aria-label="Uribe Visuals">' + sq(vac[0], vac[1]) + '<div class="ll">' + sq('#B2503A', '#F4EFE8') + '</div></div><p class="marca">Uribe Visuals</p><p class="avance">Abriendo tu Mesa</p></div>'; }
  };

  // ---------- los pasos ----------
  var E = { modo: MODO, paso: null, carga: false, version: V };
  function ver(n, o) { E.paso = n; return esperar(PANT[n](o || {}), n === 'carga' ? 'carga' : ''); }
  var digitos = function (t) { return String(t || '').replace(/\D/g, ''); };

  // Un paso que puede fallar: enseña el error en el mismo formulario y deja reintentar.
  async function conReintento(n, o, hacer) {
    var r = await ver(n, o);
    for (;;) {
      if (r.accion) return r;
      ocupado(r.form, true);
      try { var v = await hacer(r.envio); return { hecho: true, valor: v, envio: r.envio }; }
      catch (e) { if (e && e.salir) return { accion: e.salir, error: e }; fallo(r.form, e && e.mostrar ? e.mostrar : mensaje(e)); r = await siguiente(); }
    }
  }
  // El código de la app sobre una sesión (la de la Mesa o la temporal). Si la cuenta aún no tiene código, el alta (QR).
  async function factoresSeguro(c) {   // solo una respuesta buena vale como lista: un error no es «sin código» (eso lanzaría el alta)
    for (;;) {
      try { return await c.factores(); }
      catch (e) { if (red(e)) throw e; await ver('mensaje', { titulo: 'No se pudo mirar tu código', texto: esc(mensaje(e)), boton: 'Volver a intentarlo' }); }
    }
  }
  async function codigoApp(c, o, vueltas) {
    var fs = await factoresSeguro(c);
    var f = fs.filter(function (x) { return x.verificado; })[0];
    if (!f) return altaQR(c, vueltas);
    return conReintento('codigo', o, function (d) { return c.verificarApp(f.id, digitos(d['e-cod'])); });
  }
  async function altaQR(c, vueltas) {
    var al;
    try { al = await c.altaApp({ emisor: 'Mesa Uribe Visuals', nombre: 'Contraseñas' }); }
    catch (e) {
      if (e && e.codigo === 'nivel' && !(vueltas > 1)) return codigoApp(c, {}, (vueltas || 0) + 1);   // ya tiene su código: pedirlo
      await ver('mensaje', { titulo: 'No se pudo preparar el código', texto: esc(mensaje(e)), boton: 'Volver a intentarlo' }); return altaQR(c, vueltas);
    }
    return conReintento('qr', al, function (d) { return c.verificarApp(al.id, digitos(d['e-cod'])); });
  }
  function nuevaContrasena(c, o) {
    return conReintento('contrasena', o, function (d) {
      var a = d['e-n1'] || '', b = d['e-n2'] || '';
      if (a.length < 20) throw { mostrar: 'Al menos 20 caracteres.' };
      if (a !== b) throw { mostrar: 'No son iguales: pégala otra vez en las dos.' };
      return c.ponerContrasena(a).then(function () { return a; }, function (e) {
        if (e && e.codigo === 'reautenticar') throw { salir: 'reautenticar' };   // una sesión de más de 24 h: confirmar con un código por correo
        throw e;
      });
    });
  }
  // Tras entrar (contraseña + código): ¿es la cuenta de la Mesa? Se guarda cifrada y, si este navegador no tenía la nube, se trae.
  async function trasEntrar(c, contrasena, sesion) {
    var yo = null; try { yo = await c.rpc('mesa_yo', {}); } catch (e) { if (!red(e)) yo = null; }
    if (yo && yo.dueno === false) {
      try { await c.salir('local'); } catch (e) { /* */ }
      await ver('mensaje', { titulo: 'Esta cuenta no es la de tu Mesa', texto: 'Has entrado, pero el servidor no la reconoce como la dueña de la Mesa.', boton: 'Volver' });
      return 'otra';
    }
    await A.nueva(contrasena, sesion);
    await A.esperar();
    lsS('mesa-web-' + REF, null);   // la de antes, en claro: fuera (D-262)
    if (lsG(ACTIVA) !== '1') { lsS(ACTIVA, '1'); lsS(TRAER, '1'); }   // ordenador nuevo: la Mesa se trae sola (D-259 sin botón)
    try { if (M.flush) await M.flush(); } catch (e) { /* */ }
    G.location.reload();
    return new Promise(function () {});   // la página se recarga
  }
  // Entrar con un código por correo: la primera vez, tras un rescate o «¿Olvidaste tu contraseña?».
  async function porCorreo(correo, por) {
    var c = temporalCon(), olvido = por === 'olvido';
    if (!correo) {
      var r0 = await ver('pedirCorreo', { titulo: olvido ? '¿Olvidaste tu contraseña?' : 'Entra con tu correo', correo: '' });
      if (r0.accion) return 'volver';
      correo = String(r0.envio.correo || '').trim();
    }
    try { await c.pedirCodigo(correo); } catch (e) { await ver('mensaje', { titulo: 'No se pudo mandar el código', texto: esc(mensaje(e)), boton: 'Volver' }); return 'volver'; }
    var r = await conReintento('correo', { correo: correo, titulo: olvido ? 'Mira tu correo' : 'Mira tu correo', dato: olvido ? 'Paso 1 de 3 · contraseña nueva' : '' }, function (d) { return c.verificarCodigo(correo, digitos(d['e-cc'])); });
    if (r.accion === 'otro') return porCorreo(correo, por);
    if (r.accion) return 'volver';
    var fs = await factoresSeguro(c);
    var tiene = fs.some(function (f) { return f.verificado; }), pw;
    if (tiene) {   // ¿Olvidaste?: la app, y después la contraseña nueva (Supabase la pide en aal2; al cambiarla cierra las demás sesiones)
      var a = await codigoApp(c, { titulo: 'Código de tu app', dato: 'Paso 2 de 3 · contraseña nueva', texto: 'Para cambiarla, además del correo, el código de <b>Contraseñas</b>.', boton: 'Seguir', ayuda: '¿Sin tu iPhone ni tu Mac? Hace falta el rescate desde tu Mac de trabajo: pídeselo a Claude.' });
      if (a.accion) return 'volver';
      var n = await nuevaContrasena(c, { titulo: 'Tu contraseña nueva', dato: 'Paso 3 de 3', correo: correo, boton: 'Guardar y entrar', nota: 'Al guardarla, tu Mesa se cierra en los demás ordenadores: allí te pedirá la nueva y el código. Lo que tengan sin subir se queda allí y sube al volver a entrar.' });
      if (n.accion) return 'volver';
      pw = n.valor;
    } else {   // primera vez (o tras un rescate): la contraseña y el QR
      var n2 = await nuevaContrasena(c, { titulo: 'Crea tu contraseña', dato: 'Paso 1 de 2 · solo esta vez', correo: correo });
      if (n2.accion) return 'volver';
      pw = n2.valor;
      var q = await altaQR(c); if (q.accion) return 'volver';
    }
    return trasEntrar(c, pw, c._sesionEntera());
  }
  // Ordenador nuevo (o la guardada ya no vale): correo y contraseña en el servidor, y el código.
  async function entrarNuevo(o) {
    for (;;) {
      var c = temporalCon(), pwUsada = '';
      var r = await conReintento('nuevo', o || {}, function (d) {
        pwUsada = d['e-pw'] || '';
        return c.entrarConContrasena(String(d.correo || '').trim(), pwUsada);
      });
      if (r.accion === 'olvido' || r.accion === 'primera') { var v = await porCorreo(String((D.getElementById('e-co') || {}).value || (o && o.correo) || '').trim(), r.accion); if (v === 'volver' || v === 'otra') continue; return v; }
      if (r.accion) continue;
      var a = await codigoApp(c, { nota: 'En este navegador no te lo vuelve a pedir en 30 días.' });
      if (a.accion) continue;
      var t = await trasEntrar(c, pwUsada, c._sesionEntera()); if (t === 'otra') continue;
      return t;
    }
  }
  // Ventana o pestaña nueva con la sesión guardada: la contraseña la abre en este Mac (sin red). Si no la abre y hay red, se prueba
  // en el servidor (pudo cambiarse en otro ordenador).
  async function entrarCifrado() {
    var b = A.guardada();
    for (;;) {
      var r = await conReintento('entrar', { correo: b.correo, vence: b.vence || 0 }, function (d) {
        var pw = d['e-pw'] || '';
        return A.desbloquear(pw).then(function () { return { abierta: true }; }, function () {
          var t = temporalCon();
          return t.entrarConContrasena(b.correo, pw).then(function () { return { nueva: t, pw: pw }; }, function (e) {
            if (e && e.codigo === 'credenciales') throw { mostrar: 'Esa no es tu contraseña.' };
            if (red(e)) throw { mostrar: 'Esa no es tu contraseña (sin conexión no se puede mirar si la cambiaste en otro ordenador).' };
            throw e;
          });
        });
      });
      if (r.accion === 'otra') { A.guardar(null); return entrarNuevo({}); }
      if (r.accion === 'olvido') { var v = await porCorreo(b.correo, 'olvido'); if (v === 'volver') continue; return v; }
      if (r.accion) continue;
      if (r.valor && r.valor.nueva) {   // la contraseña cambió en otro ordenador: entrada nueva aquí
        var t = r.valor.nueva, a = await codigoApp(t, {});
        if (a.accion) continue;
        return trasEntrar(t, r.valor.pw, t._sesionEntera());
      }
      return 'abierta';
    }
  }
  // Abierta: ¿vale aún la sesión y el código? (renovar; sin red, se abre con lo de aquí).
  async function comprobar() {
    var c = X.supa && X.supa(); if (!c) return;
    var n = null;
    try { n = await c.vigente(); }
    catch (e) {
      if (e && e.codigo === 'sesion') return entrarNuevo({ correo: (A.guardada() || {}).correo, aviso: 'Tu sesión se cerró: entra otra vez' });
      return;   // sin red, un 429 o el servidor ocupado: abre con lo de aquí (D-255); al volver, la nube pide lo que falte
    }
    if (!c.usuario()) return entrarNuevo({ correo: (A.guardada() || {}).correo, aviso: 'Tu sesión se cerró: entra otra vez' });
    if (pideCodigo(n, Date.now())) {
      var tenia = n && n.totp;
      var a;
      try { a = await codigoApp(c, tenia ? { titulo: 'Han pasado 30 días', dato: 'Último código en este navegador: ' + esc(fecha(n.totp * 1000)), texto: 'Escribe el código de tu app <b>Contraseñas</b>. Después, otros 30 días sin pedírtelo aquí.' } : {}); }
      catch (e) { if (red(e)) return; throw e; }   // sin red: abre con lo de aquí; el servidor lo pedirá al volver
      if (a && a.accion) return comprobar();
      await A.esperar();
    }
  }
  // Migrar (la sesión de antes, en claro, del código por correo): el alta con «Ahora no» hasta hacerla.
  async function migrar() {
    var c = X.supa && X.supa(); var u = c && c.usuario();
    if (!u) { E.modo = 'nuevo'; return entrarNuevo({}); }
    var r = await nuevaContrasena(c, { titulo: 'Configura tu entrada', dato: 'Paso 1 de 2 · solo esta vez', correo: u.email, ahoraNo: true, nota: 'Desde ahora entrarás con esta contraseña y el código de tu app (Contraseñas). Mientras no lo hagas, tu Mesa abre como hasta hoy.' });
    if (r.accion === 'ahora-no') return 'ahora-no';
    if (r.accion === 'reautenticar') return porCorreo(u.email, 'primera');   // con una sesión fresca del correo, lo mismo
    if (r.accion) return migrar();
    var q = await altaQR(c); if (q.accion) return migrar();
    // la sesión de la Mesa (en claro) pasa a la guardada cifrada: la misma, la que usa la nube
    var s = null; try { s = JSON.parse(localStorage.getItem('mesa-web-' + REF) || 'null'); } catch (e) { s = null; }
    return trasEntrar(c, r.valor, s);
  }
  // Lo que llama arranque.js antes de MESA.boot(): resuelve cuando la Mesa puede abrir.
  E.abrir = async function () {
    if (MODO === 'sin_proyecto' || !G.Supa || !G.crypto || !G.crypto.subtle) return 'sin_proyecto';
    try {
      if (MODO === 'migrar') { var m = await migrar(); quitar(); return m; }
      if (MODO === 'nuevo') return await entrarNuevo({});
      if (!(A.abierta() && await A.sincronizar())) {   // recargar: no la pide (salvo que otra entrada de este navegador la cambiara)
        if (await entrarCifrado() !== 'abierta') return 'otra';
      }
      await comprobar();
      quitar();
      return 'abierta';
    } catch (e) {
      console.warn('entrada:', e && e.message);
      await ver('mensaje', { titulo: 'No se pudo entrar', texto: esc(mensaje(e)), boton: 'Volver a intentarlo' });
      G.location.reload();
      return new Promise(function () {});
    }
  };
  // ---------- la pantalla de carga (B: el monograma se llena) ----------
  var cargaT = 0, cargaFin = false;
  E.cargaDurante = function () {
    if (MODO === 'sin_proyecto') return;
    cargaFin = false;
    var ya = lsG(TRAER) === '1';
    var mostrar = function () { if (cargaFin) return; E.carga = true; capa(PANT.carga(), 'carga'); E.paso = 'carga'; };
    if (ya) mostrar(); else cargaT = setTimeout(mostrar, 400);
  };
  E.avance = function (hechos, total) {
    if (!E.carga || !capaEl) return;
    var t = Math.max(+total || 0, +hechos || 0), h = Math.min(+hechos || 0, t), f = t ? h / t : 0;
    var ll = capaEl.querySelector('.ll'), av = capaEl.querySelector('.avance');
    if (ll) ll.style.clipPath = 'inset(' + ((1 - f) * 100).toFixed(1) + '% 0 0 0)';
    if (av) av.innerHTML = t ? 'Bajando tu Mesa · ' + h.toLocaleString('es-ES') + ' <span>de</span> ' + t.toLocaleString('es-ES') : 'Abriendo tu Mesa';
  };
  E.cargaFin = function () {
    cargaFin = true; clearTimeout(cargaT);
    if (!E.carga || !capaEl) { if (E.paso === 'carga') quitar(); return; }
    E.carga = false;
    if (reducir()) { quitar(); return; }
    E.avance(1, 1); var el = capaEl; el.classList.add('fuera'); setTimeout(function () { if (el === capaEl) quitar(); else el.remove(); }, 260);
  };
  // ---------- el código con la Mesa abierta (la nube recibió «verificacion»: pasaron los 30 días) ----------
  var pidiendo = false;
  E.pedirCodigo = async function () {
    if (pidiendo || !X.showDialog || D.querySelector('form[data-entrada="codigo"]')) return;
    if (X.shellReady && !X.shellReady()) { E._esperas = (E._esperas || 0) + 1; if (E._esperas < 100) setTimeout(E.pedirCodigo, 300); return; }   // la nube lo pide al abrir, antes de dibujar
    E._esperas = 0; pidiendo = true;
    var c = X.supa && X.supa(), f = null;
    try { f = ((await c.factores()) || []).filter(function (x) { return x.verificado; })[0]; } catch (e) { /* */ }
    if (!f) { pidiendo = false; return X.toast && X.toast('Falta el código de tu app: recarga la Mesa para entrar otra vez.', { error: true }); }
    X.showDialog('nube', '<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Falta el código de tu app</h3><form class="form" data-entrada="codigo" autocomplete="off"><p class="nubep">' + (c.nivel && c.nivel() && c.nivel().totp ? 'Han pasado 30 días desde el último en este navegador.' : 'Sin él, el servidor no recibe nada de esta Mesa.') + ' Tus cambios están a salvo aquí y suben en cuanto lo escribas.</p>'
      + '<label for="ent-cod">Código de Contraseñas</label><input id="ent-cod" name="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required><p class="ferr" role="alert" hidden></p>'
      + '<div class="row"><button type="button" class="btn2" data-act="close">Más tarde</button><button type="submit" class="btn">Seguir</button></div></form>');
    setTimeout(function () { var i = D.getElementById('ent-cod'); if (i) i.focus(); pidiendo = false; }, 0);
    E._factor = f.id;
  };
  D.addEventListener('submit', async function (e) {
    var f = e.target.closest && e.target.closest('form[data-entrada="codigo"]'); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    var p = f.querySelector('.ferr'), b = f.querySelector('[type=submit]'); if (b) b.disabled = true;
    try { await X.supa().verificarApp(E._factor, digitos(f.codigo.value)); await (A ? A.esperar() : null); var x = f.closest('.detail'); var c = x && x.querySelector('[data-act="close"]'); if (c) c.click(); if (X.toast) X.toast('Código escrito: tu Mesa sigue subiendo.'); }
    catch (er) { if (p) { p.hidden = false; p.textContent = mensaje(er); } if (b) b.disabled = false; }
  }, true);
  E.estado = function () { var c = X.supa && X.supa(), n = c && c.nivel && c.nivel(); return { modo: E.modo, paso: E.paso, carga: E.carga, sesion: !!(c && c.usuario()), nivel: n ? n.aal : null, vence: venceCodigo(n) || null, abierta: A ? A.abierta() : false }; };
  E.salir = async function () { try { await X.supa().salir('local'); } catch (e) { /* */ } if (A) { lsS(A.CLAVES.BLOB, null); try { sessionStorage.removeItem(A.CLAVES.SES); sessionStorage.removeItem(A.CLAVES.LLAVE); } catch (e) { /* */ } } G.location.reload(); };
  E._test = { pantalla: function (n, o) { E.paso = n; return capa(PANT[n](o || {}), n === 'carga' ? 'carga' : ''); }, quitar: quitar, nucleo: G.EntradaNucleo };
  M.entrada = E;
  (G.MESA_CARGA = G.MESA_CARGA || {}).entrada = 'ok';
})();
