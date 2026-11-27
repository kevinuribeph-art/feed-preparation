// Portal de clientes · Uribe Visuals (D-241, D-242). Sin dependencias ni compilación; habla con el servidor por `supa.js`.
// Todo texto que llega del servidor o del cliente se pinta con `textContent` (nunca innerHTML) y la página no tiene código en
// línea (CSP). Lo que ve: su feed, su calendario, por qué este calendario, sus pagos y cómo fue el mes anterior; lo que
// hace: aprobar, pedir cambios con motivo y comentar.
(function portal() {
  'use strict';
  const V = '1.15';   // 1.15: a sporadic client (servicio «sesiones»): its sessions with their calendar, its tasks and notes, a session's sheet with its comments (D-378). 1.14: «Tu plan» (D-376).   // 1.13: a pending invoice with only a due date shows, as in «Vista cliente» (D-368); in landscape nothing sits under the notch (portal.css, D-366). 1.12: al parar lejos del punto de un mes, la tira se centra sola en el mes activo (D-P14, como D-338 de la Mesa). 1.11: lo visto simulando el iPhone: girar no aleja la página, los puntos al cambiar el alto, la inercia larga (D-P11 a D-P13). 1.10: con algo por aprobar y la página deslizando, abre arriba, con el aviso a la vista (D-P10). 1.9: el feed seguido, con todos los meses, la cabecera de meses y su movimiento, como la «Vista cliente» (feed continuo; feed-mov.js 1.0). 1.8: un cliente de solo contenido sin meses: su lista entera y sus sesiones que vienen, sin calendario, como la «Vista cliente» (D-312). 1.7: «Tus pagos» con el acuerdo de cuándo a cuándo, lo que incluye su paquete y la siguiente por su fecha (D-308). 1.6: a pantalla completa (D-293), «Ver más en Zernio» (D-294), la ventana de una publicación como Instagram (D-295), las flechas del carrusel (D-296), «Tus pagos» con su tramo, las entregas de un cliente de solo contenido y la reunión (D-297). 1.5: el aviso de demasiados intentos ya no promete un minuto (D-280). 1.4: la cuenta que solo mira: ve cada cliente como lo ve él, sin aprobar, pedir cambios ni comentar (D-266). 1.3: el monograma a la izquierda de la barra, sin pulsar, y la página con las medidas de la «Vista cliente» (D-264)
  const app = document.getElementById('app');
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* */ }   // el feed se coloca solo en su mes: al recargar, el navegador no lo mueve a donde estaba
  const CFG = window.PORTAL_CONFIG || {};
  const TZ = 'Europe/Madrid';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const C_PUB = 'cliente_id,pid,mes,orden,tipo,nombre,fecha,sin_hora,caption,imagenes,estado,version,visible,enviada';
  const C_APR = 'id,cliente_id,pid,version,decision,motivo,diapositiva,autor_nombre,hora';
  const C_COM = 'id,cliente_id,pid,version,diapositiva,texto,autor_nombre,de_kevin,hora,resuelto';
  const ESTADO = { preparando: ['En preparación', 'pr'], por_aprobar: ['Por aprobar', 'ap'], aprobada: ['Aprobada', 'ok'], cambios: ['Pediste cambios', 'cb'], programada: ['Programada', 'ok'], publicada: ['Publicada', 'ok'] };
  const visto = p => (p.estado === 'programada' && p.fecha && Date.parse(p.fecha) <= Date.now() ? { ...p, estado: 'publicada' } : p);
  const TIPO = { foto: 'Foto', carrusel: 'Carrusel', reel: 'Reel', collab_reel: 'Collab', trial_reel: 'Reel' };

  // ---------- pequeñas herramientas ----------
  function h(tag, at, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(at || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  function ico(n, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-' + n); s.append(u); return s;
  }
  const FMT = new Map();   // un formateador por forma (crearlo cuesta: el feed seguido pinta todos los meses)
  const partes = (t, o) => { const k = JSON.stringify(o); let f = FMT.get(k); if (!f) FMT.set(k, f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o })); return Object.fromEntries(f.formatToParts(t).map(p => [p.type, p.value])); };
  const hoy = () => { const p = partes(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' }); return `${p.year}-${p.month}-${p.day}`; };
  const diaDe = iso => { const p = partes(new Date(iso), { year: 'numeric', month: '2-digit', day: '2-digit' }); return `${p.year}-${p.month}-${p.day}`; };
  const horaDe = iso => { const p = partes(new Date(iso), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); return `${p.hour}:${p.minute}`; };
  const dsem = dia => DIAS[new Date(dia + 'T12:00:00Z').getUTCDay()];
  const madrid = dia => new Date(dia + 'T11:00:00Z').toISOString();   // una entrega, a mediodía de su día en Madrid (para ordenar la lista)
  const may = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  const mesEt = m => may(MESES[+m.slice(5, 7) - 1].slice(0, 3)) + (m.slice(0, 4) !== hoy().slice(0, 4) ? ' ' + m.slice(2, 4) : '');   // «Nov», «Ene 27»: el año solo si no es el de hoy
  const mesNom = m => MESES[+m.slice(5, 7) - 1] + (m.slice(0, 4) !== hoy().slice(0, 4) ? ' ' + m.slice(0, 4) : '');
  const mesAntes = m => { let [y, mo] = m.split('-').map(Number); mo--; if (!mo) { mo = 12; y--; } return `${y}-${String(mo).padStart(2, '0')}`; };
  const mesDespues = m => { let [y, mo] = m.split('-').map(Number); mo++; if (mo > 12) { mo = 1; y++; } return `${y}-${String(mo).padStart(2, '0')}`; };
  const diaCorto = d => +d.slice(8, 10) + ' ' + MESES[+d.slice(5, 7) - 1].slice(0, 3);
  const fechaPub = p => { if (!p.fecha) return 'Sin fecha'; const d = diaDe(p.fecha); return may(dsem(d)) + ' ' + diaCorto(d) + (p.sin_hora ? '' : ' · ' + horaDe(p.fecha)); };
  const cuando = iso => { const d = diaDe(iso), t = horaDe(iso); if (d === hoy()) return 'hoy, ' + t; const ay = diaDe(Date.now() - 864e5); return d === ay ? 'ayer, ' + t : diaCorto(d) + ', ' + t; };
  const num = (n, o) => Number(n).toLocaleString('es-ES', o);
  const cifra = n => n >= 999950 ? num(n / 1e6, { maximumFractionDigits: 1 }) + ' mill.' : n >= 1000 ? num(n / 1000, { maximumFractionDigits: 1 }) + ' mil' : num(n);
  const eur = c => { const v = Math.round(c) / 100; return (Number.isInteger(v) ? num(v) : num(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €'; };
  function cambio(v, a, mAnt) {
    if (a == null) return { t: 'sin datos de ' + MESES[+mAnt.slice(5, 7) - 1], k: '' };
    if (a === 0) return v ? { t: 'frente a 0', k: '' } : { t: 'igual', k: '' };
    const p = Math.round((v - a) / a * 100);
    return p ? { t: (p > 0 ? '+' : '−') + num(Math.abs(p)) + ' %', k: p > 0 ? 'sube' : 'baja' } : { t: 'igual', k: '' };
  }
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  let toastT = 0;
  function toast(t) { clearTimeout(toastT); document.querySelectorAll('.toast').forEach(x => x.remove()); const el = h('div', { class: 'toast', role: 'status', text: t }); document.body.append(el); toastT = setTimeout(() => el.remove(), 4000); }
  const frase = t => { t = String(t || '').trim(); if (!t) return 'No se pudo.'; t = t[0].toUpperCase() + t.slice(1); return /[.!?]$/.test(t) ? t : t + '.'; };
  const msgError = e => !e ? 'No se pudo.' : e.codigo === 'red' ? 'Sin conexión: inténtalo otra vez.' : e.codigo === 'codigo' ? 'Ese código no vale o ha caducado. Pide otro.' : e.status === 409 ? frase(e.message || 'Ha cambiado: vuelve a mirarla') : e.status === 429 ? frase(e.message || 'Demasiados intentos: espera unos minutos y vuelve a probar') : e.status === 401 ? 'Tu sesión ha caducado: vuelve a entrar.' : frase(e.message);

  // ---------- servidor ----------
  let S = null;
  try { S = window.Supa.crear({ url: CFG.url, publica: CFG.publica, clave: 'portal-sesion' }); } catch (e) { S = null; }
  const POR = 'Solo mirar: con esta cuenta no se aprueba, no se piden cambios ni se comenta.';   // D-266
  const st = { observa: new Set(), todoMira: false, clientes: [], cli: null, d: null, mes: null, tab: 'cal', verAnt: null, urls: new Map(), cargando: false, error: '', abierta: null, gen: 0, carga: 0, sucio: false, codigoEn: 0, ys: new Map(), colsDe: '', mesDe: new Map() };

  async function cargarClientes() {
    // `observa` (D-266): una cuenta que solo mira; un servidor que aún no la tiene contesta 400 y se lee como siempre
    let mios;
    try { mios = await S.leer('miembros?select=cliente_id,nombre,observa'); }
    catch (e) { if (e.status !== 400) throw e; mios = await S.leer('miembros?select=cliente_id,nombre'); }
    st.observa = new Set((mios || []).filter(m => m.observa === true).map(m => m.cliente_id));
    st.todoMira = !!(mios || []).length && (mios || []).every(m => m.observa === true);
    const ids = [...new Set((mios || []).map(m => m.cliente_id))];
    if (!ids.length) return [];
    // `metricas` (D-294), el acuerdo y el servicio (D-297) y el acuerdo de cuándo a cuándo con su paquete (D-308): un servidor que
    // aún no los tiene contesta 400 y se lee como antes, un escalón cada vez
    // «Tu plan» (D-376): lo del mes sin IVA, su IVA, lo que no incluye y sus condiciones, otro escalón
    const en = ids.map(encodeURIComponent).join(','), C0 = 'id,nombre,handle,foto,cuota_cent,proxima_emision', C1 = 'metricas,servicio,pago,pago_cent,cubre_de,cubre_hasta', C2 = 'acuerdo_de,acuerdo_hasta,acuerdo_renueva,paquete,incluye', C3 = 'plan_mes_cent,iva,no_incluye,condiciones';
    let l;
    for (const cols of [`${C0},${C1},${C2},${C3}`, `${C0},${C1},${C2}`, `${C0},${C1}`, C0]) {
      try { l = await S.leer(`clientes?select=${cols}&id=in.(${en})`); break; } catch (e) { if (e.status !== 400 || cols === C0) throw e; }
    }
    return (l || []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  // una lectura con columnas nuevas (D-297): un servidor que aún no las tiene contesta 400 y se lee sin ellas
  const leerCon = (t, cols, extra, resto) => S.leer(`${t}?select=${cols},${extra}${resto}`).catch(e => { if (e.status !== 400) throw e; return S.leer(`${t}?select=${cols}${resto}`); });
  async function cargarDatos(cli, antes) {
    const c = encodeURIComponent(cli), prev = antes || {}, esp = (st.clientes.find(x => x.id === cli) || {}).servicio === 'sesiones';   // un esporádico (D-378)
    const pide = [
      S.leer(`publicaciones?select=${C_PUB}&cliente_id=eq.${c}&order=mes.desc,orden.asc`),
      S.leer(`aprobaciones?select=${C_APR}&cliente_id=eq.${c}&order=hora.asc`),
      S.leer(`comentarios?select=${C_COM}&cliente_id=eq.${c}&order=hora.asc`),
      leerCon('sesiones', 'id,mes,nombre,inicio,fin,sin_hora', esp ? 'clase,contenido,fotos' : 'clase', `&cliente_id=eq.${c}`),
      S.leer(`meses?select=mes,porque,resumen&cliente_id=eq.${c}`),
      leerCon('pagos', 'id,periodo,concepto,importe_cent,factura,emitida,vence,cobrada,pdf', 'hasta', `&cliente_id=eq.${c}`),
      S.leer(`entregas?select=id,fecha,que,cuanto,enlace,entregada&cliente_id=eq.${c}&order=fecha.asc`),
      // un esporádico (D-378): sus tareas y notas que ve y la conversación de sus sesiones
      esp ? S.leer(`tareas_notas?select=id,tipo,texto,fecha,hecha,orden&cliente_id=eq.${c}&order=orden.asc`) : Promise.resolve([]),
      esp ? S.leer(`comentarios_sesion?select=${C_CS}&cliente_id=eq.${c}&order=hora.asc`) : Promise.resolve([]),
    ];
    const r = await Promise.allSettled(pide);
    const mal = r.find(x => x.status === 'rejected');
    if (mal && (mal.reason.status === 401 || mal.reason.codigo === 'sesion')) throw mal.reason;
    if (r.slice(0, 3).some(x => x.status === 'rejected')) throw r.slice(0, 3).find(x => x.status === 'rejected').reason;   // sin publicaciones ni conversación, no se pinta
    const v = (i, k) => (r[i].status === 'fulfilled' ? r[i].value || [] : prev[k] || []);   // un panel que falla se queda como estaba
    return { pubs: v(0, 'pubs').map(visto), aprs: v(1, 'aprs'), coms: v(2, 'coms'), ses: v(3, 'ses'), meses: v(4, 'meses'), pagos: v(5, 'pagos'), ents: v(6, 'ents'), tn: v(7, 'tn'), cses: v(8, 'cses'),
      entsMal: r[6].status === 'rejected' && (!prev.ents || !!prev.entsMal) };   // una lectura fallida no es «sin entregas» (lección 94)
  }
  // URL firmadas (10 minutos): se piden juntas y se guardan hasta un minuto antes de caducar.
  async function urls(rutas, bucket = 'fotos') {
    const ahora = Date.now(), faltan = [...new Set(rutas.filter(r => r && !((st.urls.get(r) || {}).hasta > ahora)))];
    for (let i = 0; i < faltan.length; i += 100) {
      const m = await S.firmar(bucket, faltan.slice(i, i + 100));
      for (const [r, u] of Object.entries(m)) st.urls.set(r, { url: u, hasta: ahora + (bucket === 'fotos' ? 9 : 0.75) * 60000 });
    }
    return Object.fromEntries(rutas.map(r => [r, (st.urls.get(r) || {}).url]));
  }

  // ---------- entrada ----------
  // tu logo (tinta en claro, papel en oscuro), el contenido centrado y «Privacidad · Aviso legal» abajo del todo (D-248)
  const logo = () => h('div', { class: 'ent-m' }, h('picture', {}, h('source', { srcset: 'marca/logo-paper.svg', media: '(prefers-color-scheme: dark)' }),
    h('img', { src: 'marca/logo-ink.svg', alt: 'Uribe Visuals', width: '163', height: '64' })));
  const legal = () => h('footer', { class: 'legal' }, h('a', { href: 'privacidad.html', text: 'Privacidad' }), h('a', { href: 'aviso-legal.html', text: 'Aviso legal' }));
  const entrada = c => h('div', { class: 'ent' }, c, legal());
  function pintarEntrada(paso, correo, error, tecleado) {
    st.d = null; st.urls.clear(); st.pvDe = ''; limpiarFeed(); cerrar(true);
    document.querySelectorAll('.dlg,.velo,.toast').forEach(x => x.remove());
    const err = error ? h('p', { class: 'err', id: 'ent-err' }, ico('alert'), error) : null;
    if (paso !== 'codigo') {
      const inp = h('input', { id: 'e-correo', type: 'email', autocomplete: 'email', inputmode: 'email', required: true, value: correo || '' });
      const form = h('form', { class: 'ent-c', novalidate: true, onsubmit: async e => {
        e.preventDefault(); const v = inp.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return pintarEntrada('correo', v, 'Ese correo no parece bien escrito.');
        const b = form.querySelector('button'); b.disabled = true;
        try { await S.pedirCodigo(v); st.codigoEn = Date.now(); lsSet('portal-correo', v); pintarEntrada('codigo', v); } catch (x) { pintarEntrada('correo', v, msgError(x)); }
      } },
        logo(), h('h1', { text: 'Tu calendario de Instagram' }),
        h('p', { text: 'Escribe el correo con el que trabajamos y te mandamos un código para entrar.' }),
        h('label', { for: 'e-correo', text: 'Correo' }), inp, err, h('button', { class: 'btn p', type: 'submit', text: 'Enviarme el código' }));
      app.replaceChildren(entrada(form)); inp.focus();
      return;
    }
    const cod = h('input', { id: 'e-cod', class: 'cod' + (error ? ' mal' : ''), inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', required: true, 'aria-describedby': error ? 'ent-err' : null, value: tecleado || '' });
    let quedan = Math.max(0, 60 - Math.floor((Date.now() - st.codigoEn) / 1000));
    const reenviar = h('button', { class: 'lnk', type: 'button', disabled: quedan > 0, text: quedan > 0 ? `Reenviar en ${Math.floor(quedan / 60)}:${String(quedan % 60).padStart(2, '0')}` : 'Reenviar código', onclick: async () => { try { await S.pedirCodigo(correo); st.codigoEn = Date.now(); pintarEntrada('codigo', correo); } catch (x) { pintarEntrada('codigo', correo, msgError(x)); } } });
    const t = setInterval(() => { if (!reenviar.isConnected) return clearInterval(t); quedan = Math.max(0, 60 - Math.floor((Date.now() - st.codigoEn) / 1000)); if (quedan <= 0) { clearInterval(t); reenviar.disabled = false; reenviar.textContent = 'Reenviar código'; } else reenviar.textContent = `Reenviar en ${Math.floor(quedan / 60)}:${String(quedan % 60).padStart(2, '0')}`; }, 1000);
    const form = h('form', { class: 'ent-c', novalidate: true, onsubmit: async e => {
      e.preventDefault(); const b = form.querySelector('button[type=submit]'); b.disabled = true;
      try { await S.verificarCodigo(correo, cod.value); await arrancar(); } catch (x) { pintarEntrada('codigo', correo, msgError(x), cod.value); }
    } },
      logo(), h('h1', { text: 'Mira tu correo' }),
      h('p', { text: `Si ${correo} está dado de alta, te llega un código de 6 cifras. Vale 10 minutos.` }),
      h('label', { for: 'e-cod', text: 'Código' }), cod, err, h('button', { class: 'btn p', type: 'submit', text: 'Entrar' }),
      h('div', { class: 'otros' }, reenviar, h('button', { class: 'lnk', type: 'button', text: 'Usar otro correo', onclick: () => pintarEntrada('correo', correo) })));
    app.replaceChildren(entrada(form)); cod.focus();
  }

  // ---------- su vista ----------
  const visibles = () => (st.d ? st.d.pubs.filter(p => p.visible) : []);
  const delMes = m => visibles().filter(p => p.mes === m).sort((a, b) => a.orden - b.orden);
  const pendientes = () => visibles().filter(p => p.estado === 'por_aprobar').sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  function mesesDisponibles() {
    const s = new Set([...visibles().map(p => p.mes), ...st.d.ses.map(x => x.mes), ...(st.d.ents || []).map(x => x.fecha.slice(0, 7))]);
    return [...s].sort().reverse();
  }
  // El mes con el que se abre un cliente. Con la página como el que desliza (por debajo de 1100 × 700, opción B) y algo por aprobar,
  // el portal abre ARRIBA del todo: se ven las cuentas, el aviso y «Revisarlas», con la cabecera y el feed debajo; el mes activo es
  // el del punto más cercano a esa posición (el más nuevo con casillas). Si no, `mesInicial`, como siempre (D-P10).
  const llenoSi = () => app.clientWidth >= 1100 && window.innerHeight >= 700;
  function mesAbrir() {
    st.abrirArriba = false;
    const cli = st.clientes.find(c => c.id === st.cli);
    if (!(cli && cli.servicio === 'contenido') && pendientes().length && !llenoSi()) { const g = feedGrupos()[0]; if (g) { st.abrirArriba = true; return g.m; } }
    return mesInicial();
  }
  function mesInicial() {
    const ms = mesesDisponibles(), p = pendientes()[0], h0 = hoy().slice(0, 7);
    if (p) return p.mes;
    return ms.find(m => m <= h0) || ms[ms.length - 1] || h0;
  }
  async function arrancar() {
    if (!S) { app.replaceChildren(h('p', { class: 'cargando', text: 'El portal aún no está configurado.' })); return; }
    if (!S.usuario()) return pintarEntrada('correo', lsGet('portal-correo') || '');
    app.replaceChildren(h('p', { class: 'cargando', text: 'Cargando tu calendario…' }));
    try {
      st.clientes = await cargarClientes();
      if (!st.clientes.length) { pintarSinCliente(); return; }
      const pref = lsGet('portal-cliente');
      st.cli = (st.clientes.find(c => c.id === pref) || st.clientes[0]).id;
      const n = ++st.carga, d = await cargarDatos(st.cli); if (n !== st.carga) return;
      st.d = d; st.mes = mesAbrir(); st.error = '';
      pintar();
    } catch (e) {
      if (e.status === 401 || e.codigo === 'sesion') return pintarEntrada('correo', lsGet('portal-correo') || '', 'Tu sesión ha caducado: vuelve a entrar.');
      pintarError(msgError(e));
    }
  }
  function pintarSinCliente() {
    st.pvDe = '';
    app.replaceChildren(entrada(h('div', { class: 'ent-c' }, logo(), h('h1', { text: 'Aún no hay nada que enseñarte' }),
      h('p', { text: 'Tu acceso todavía no tiene ningún calendario. Escríbele a Kevin.' }), h('button', { class: 'btn s', type: 'button', text: 'Salir', onclick: salir }))));
  }
  function pintarError(t) {
    st.pvDe = '';
    app.replaceChildren(h('div', { class: 'pv' }, h('div', { class: 'aviso mal', role: 'alert' }, h('div', { class: 't' }, h('b', { text: 'No se pudo cargar tu calendario' }), h('span', { text: t })),
      h('button', { class: 'btn s', type: 'button', text: 'Reintentar', onclick: arrancar }))));
  }
  async function salir() {
    try { Object.keys(localStorage).filter(k => /^portal-(borrador|motivo)-/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) { /* sin almacenamiento */ }
    await S.salir(); st.urls.clear(); st.d = null; lsSet('portal-cliente', null); pintarEntrada('correo', lsGet('portal-correo') || '');
  }

  // Pintar en su sitio (feed continuo): la primera vez de un cliente, la página entera (`pintarTodo`); después, solo lo que
  // cambió: la barra y el aviso si cambiaron, las casillas del feed cuya firma cambió (el nodo del feed se conserva: ni se
  // mueve ni pierde su posición) y lo que cuelga del mes (calendario o «Por qué», y la columna derecha). Lo llaman el repaso
  // de cada minuto, aprobar, pedir cambios, deshacer, comentar y cerrar un diálogo con algo que llegó mientras tanto.
  function pintar() {
    const cli = st.clientes.find(c => c.id === st.cli), cont = !!(cli && cli.servicio === 'contenido');
    const pv = app.querySelector(':scope > .pv');
    if (!pv || st.pvDe !== st.cli + '|' + cont || (cli && cli.servicio === 'sesiones')) return pintarTodo();   // un esporádico, entero: es poco (D-378)
    // con la página como el que desliza, lo de encima del feed (el aviso, la barra) puede cambiar de alto: el feed se queda donde se
    // ve (el navegador lo hace solo donde sabe; Safari no) y el motor lo sabe (su ancla se mueve con él)
    const F0 = !cont && st.feed && st.feed.mov && st.feed.movModo === 'win' ? st.feed : null, y0 = scrollY, g0 = F0 ? F0.grid.getBoundingClientRect().top + y0 : 0;
    const top = pintarTop(cli, cont), tira = pintarTira();
    if (top.sig !== st.sigTop) { pv.querySelector(':scope > .pv-top').replaceWith(top.nodo); st.sigTop = top.sig; }
    if (tira.sig !== st.sigTira) { app.querySelector(':scope > .pv-obs')?.remove(); if (tira.nodo) app.prepend(tira.nodo); st.sigTira = tira.sig; }
    const av = pintarAviso(), avV = pv.querySelector(':scope > .aviso');
    if (av.sig !== st.sigAviso) { if (avV) avV.remove(); if (av.nodo) pv.querySelector(':scope > .pv-top').after(av.nodo); st.sigAviso = av.sig; }
    if (F0 && F0 === st.feed) { const d = F0.grid.getBoundingClientRect().top + scrollY - g0; if (Math.abs(d) >= 1) F0.mov.corregir(Math.max(0, y0 + d), d); }
    const cols = pv.querySelector(':scope > .cols'), k = st.cli + '|' + st.mes;
    if (st.colsDe !== k) st.ys = new Map(); else scrollCols();   // otro mes: el calendario y la columna derecha, arriba
    if (cont) { const e = seguro(pintarEntregas), v = cols.querySelector(':scope > .entw'); if (e && v) v.replaceWith(e); }
    else { seguro(feedNodo); seguro(cabPoner); const c = seguro(pintarCentro), v = cols.querySelector(':scope > .cent'); if (c && v && c.outerHTML !== v.outerHTML) v.replaceWith(c); }
    // la columna derecha: solo la tarjeta que cambió (la misma se queda, con lo que tocaste en ella)
    const lado = pintarLado(cli), lv = cols.querySelector(':scope > .lado');
    if (lv && lado) { const N = [...lado.children], V = [...lv.children]; if (N.length !== V.length || N.some((n, i) => n.dataset.p !== V[i].dataset.p)) lv.replaceWith(lado); else N.forEach((n, i) => { if (n.outerHTML !== V[i].outerHTML) V[i].replaceWith(n); }); }
    else if (lv) lv.remove(); else if (lado) cols.append(lado);
    cols.classList.toggle('con-lado', !!lado);
    lleno(); scrollCols(true); st.colsDe = k;
    pintarMinis();
  }
  // Cambió el mes activo: solo lo que cuelga del mes (el calendario o «Por qué», y «Cómo fue»). El feed, la cabecera y «Tus pagos»
  // ni se tocan.
  function pintarMes() {
    const cols = app.querySelector('.pv > .cols'), cli = st.clientes.find(c => c.id === st.cli); if (!cols) return;
    st.ys.forEach((v, k) => { if (k.startsWith('cent|') || k === 'h-comofue' || k === 'card') st.ys.delete(k); }); st.colsDe = st.cli + '|' + st.mes;
    const c = seguro(pintarCentro), v = cols.querySelector(':scope > .cent'); if (c && v) v.replaceWith(c);
    const cf = seguro(() => pintarComoFue(cli)); let lado = cols.querySelector(':scope > .lado'); const vcf = lado && lado.querySelector(':scope > [data-p="comofue"]');
    if (cf && vcf) vcf.replaceWith(cf);
    else if (cf) { if (!lado) { lado = h('div', { class: 'lado' }); cols.append(lado); } lado.append(cf); }
    else if (vcf) { vcf.remove(); if (!lado.children.length) { lado.remove(); lado = null; } }
    cols.classList.toggle('con-lado', !!lado);
  }
  const pintarLado = cli => { const l = [seguro(() => pintarPagos(cli)), seguro(() => pintarComoFue(cli))].filter(Boolean); return l.length ? h('div', { class: 'lado' }, l) : null; };
  function pintarAviso() {
    const pend = pendientes();
    return { sig: String(pend.length), nodo: pend.length ? h('section', { class: 'aviso', 'aria-label': 'Por aprobar' }, h('span', { class: 'dot', 'aria-hidden': 'true' }),
      h('div', { class: 't' }, h('b', { text: pend.length === 1 ? 'Una publicación espera tu visto bueno' : `${pend.length} publicaciones esperan tu visto bueno` }),
        h('span', { text: 'Ábrelas una a una: puedes aprobar o pedir cambios.' })),
      h('button', { type: 'button', class: 'btn p', text: pend.length === 1 ? 'Revisarla' : 'Revisarlas', onclick: () => { const p = pendientes()[0]; if (p) abrir(p.pid, true); } })) : null };
  }
  function pintarTira() {
    const sig = st.todoMira ? st.cli + '|' + st.clientes.map(c => c.id + c.nombre).join(',') : '';
    return { sig, nodo: st.todoMira ? h('div', { class: 'pv-obs', role: 'region', 'aria-label': 'Cuenta que solo mira' },
      h('span', { class: 'pv-obs-t' }, h('b', { text: 'Solo mirar' }), ' · ves cada calendario como lo ve su cliente'),
      st.clientes.length > 1 ? h('span', { class: 'pv-obs-l', text: 'Ver como' }) : null,
      st.clientes.length > 1 ? st.clientes.map(c => h('button', { type: 'button', class: 'pv-obs-c' + (c.id === st.cli ? ' on' : ''), 'aria-pressed': String(c.id === st.cli), text: c.nombre, onclick: () => irA(c.id) })) : null) : null };
  }
  function pintarTop(cli, cont) {
    // los meses ya no van aquí: la cabecera de meses va arriba del feed (feed continuo)
    const sig = [st.cli, st.todoMira, st.clientes.map(c => c.id + c.nombre).join(',')].join('|');
    return { sig, nodo: h('header', { class: 'pv-top' },
      h('img', { class: 'pv-marca', src: 'marca/monograma.svg', alt: 'Uribe Visuals', width: '24', height: '24' }),   // la marca, sin pulsar (D-264)
      // la cuenta que solo mira ve, como el cliente, solo su nombre; cambia de cliente en la tira (D-266)
      h('nav', { class: 'pv-clis', 'aria-label': 'Tus cuentas' }, (st.todoMira ? st.clientes.filter(c => c.id === st.cli) : st.clientes).map(c => h('button', { type: 'button', class: 'pv-cli' + (c.id === st.cli ? ' on' : ''), 'aria-current': c.id === st.cli ? 'page' : null, text: c.nombre,
        onclick: () => irA(c.id) }))),
      h('button', { type: 'button', class: 'pv-salir', onclick: salir, 'aria-label': 'Salir' }, ico('out'), h('span', { class: 'tx', text: 'Salir' }))) };
  }
  // la página entera: al entrar, al cambiar de cliente o si pasa a ser (o deja de ser) de solo contenido
  function pintarTodo() {
    const cli = st.clientes.find(c => c.id === st.cli), esp = !!(cli && cli.servicio === 'sesiones'), cont = !!(cli && cli.servicio === 'contenido') || esp;   // un esporádico, sin meses ni feed (D-378)
    if (cont) limpiarFeed();
    const top = pintarTop(cli, cont), tira = pintarTira(), av = pintarAviso();
    // la columna derecha solo si tiene algo; sin ella, el calendario ocupa su sitio (como la «Vista cliente» de la Mesa, D-230, D-246)
    const lado = pintarLado(cli);
    // de solo contenido (D-312): su lista entera, sin calendario ni meses, y «Tus pagos» a la derecha, como la «Vista cliente»
    const cols = esp ? h('div', { class: 'cols cont esp' + (lado ? ' con-lado' : '') }, seguro(pintarSesEsp), seguro(pintarTN), lado)   // sus sesiones con su calendario · sus tareas y notas · «Tus pagos», como su «Vista cliente» (D-378)
      : h('div', { class: 'cols' + (cont ? ' cont' : '') + (lado ? ' con-lado' : '') }, cont ? seguro(pintarEntregas) : seguro(feedNodo), cont ? null : seguro(pintarCentro), lado);
    const pie = h('footer', { class: 'pie' }, h('a', { href: 'privacidad.html', text: 'Privacidad' }), h('a', { href: 'aviso-legal.html', text: 'Aviso legal' }), h('span', { text: 'Uribe Visuals' }));
    const y = window.scrollY, k = st.cli + '|' + st.mes;
    if (st.colsDe !== k) st.ys = new Map(); else scrollCols();   // otro cliente u otro mes: arriba
    app.replaceChildren(...[tira.nodo, h('div', { class: 'pv' }, top.nodo, av.nodo, cols, pie)].filter(Boolean));
    st.sigTop = top.sig; st.sigTira = tira.sig; st.sigAviso = av.sig; st.pvDe = st.cli + '|' + cont;
    window.scrollTo(0, y);
    lleno();
    scrollCols(true);
    st.colsDe = k;
    if (!cont) seguro(cabPoner);
    pintarMinis();
  }
  // A pantalla completa (D-293): con las tres columnas (desde 1100 px de ancho) y 700 px de alto o más, cada columna mide el
  // alto de la pantalla menos lo de encima (la cabecera, el aviso) y se desliza dentro (portal.css, `.pv.lleno`).
  function lleno() {
    const pv = app.querySelector('.pv'), cols = pv && pv.querySelector('.cols'); if (!cols) return;
    const si = app.clientWidth >= 1100 && window.innerHeight >= 700, antes = pv.classList.contains('lleno');
    pv.classList.toggle('lleno', si);
    if (si !== antes && st.feed && st.feed.puesto && movMontar()) { movMedir(); feedColocar(); }   // cambia quién desliza el feed: el feed vuelve al punto de su mes
    if (si) pv.style.setProperty('--cols-top', Math.round(cols.getBoundingClientRect().top + window.scrollY) + 'px');   // CSSOM: la CSP lo deja (lección 243)
  }
  // A pantalla completa cada columna se desliza dentro: repintar (una pestaña, «Ver las anteriores», aprobar, el repaso de cada
  // minuto) no la devuelve arriba (revisión en frío; D-240: nada salta mientras se lee). Se guarda la de cada columna y pestaña
  // de este cliente y este mes (st.ys); `volver` las devuelve.
  const claveCol = e => e.classList.contains('cent') ? 'cent|' + (e.dataset.tab || '') : e.getAttribute('aria-labelledby') || e.className.split(' ').filter(c => c !== 'card')[0] || '';   // la pestaña de esa columna, no la de ahora
  function scrollCols(volver) {
    const l = [...app.querySelectorAll('.cols > *, .lado > *')];
    if (!volver) { l.forEach(e => st.ys.set(claveCol(e), e.scrollTop)); return; }
    l.forEach(e => { const v = st.ys.get(claveCol(e)); if (v) e.scrollTop = v; });
  }
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => lleno());   // la cabecera, con cada letra que llega (600 y 800 se piden al pintar)
  let llenoRaf = 0;
  // una vez por cuadro (lección 113); y los puntos de los meses otra vez: el alto de la pantalla cambió (sin esto, al bajar el alto de la
  // ventana los puntos se quedaban en los de antes hasta otro cambio de tamaño del contenido; D-P12)
  window.addEventListener('resize', () => { cancelAnimationFrame(llenoRaf); llenoRaf = requestAnimationFrame(() => { lleno(); seguro(cabColocar); }); });

  async function irA(id) {
    if (id === st.cli) return;
    if (st.cli && st.mes) st.mesDe.set(st.cli, st.mes);   // al volver a este cliente, su feed en el mes en que lo dejaste
    st.cli = id; lsSet('portal-cliente', id); const n = ++st.carga; cerrar(true); limpiarFeed();
    const d = await cargarDatos(id).catch(e => { if (n === st.carga) pintarError(msgError(e)); return null; });
    if (d && n === st.carga) { st.d = d; const m = st.mesDe.get(id); st.mes = m && mesesDisponibles().includes(m) ? (st.abrirArriba = false, m) : mesAbrir(); pintar(); }
  }
  const soloMira = () => st.observa.has(st.cli);   // D-266
  function seguro(f) { try { return f(); } catch (e) { if (window.console) console.error(e); return null; } }
  // ---------- el feed ----------
  // Un nodo que se conserva por cliente (st.feed): `pintar()` no lo rehace; solo cambia las casillas cuya firma cambió (foto, estado,
  // fecha, tipo, comentarios, etiqueta) y, si un mes cambia de publicaciones, solo ese mes. Cada mes, en su envoltorio `.fm-m`
  // (display: contents: no rompe las filas de la rejilla).
  const cuentaComs = () => { const n = new Map(); for (const c of st.d.coms) n.set(c.pid, (n.get(c.pid) || 0) + 1); return n; };
  const sigCelda = (p, et, nc) => [p.estado, p.fecha, p.sin_hora, p.tipo, p.imagenes.length && p.imagenes[0].mini, nc.get(p.pid) || 0, JSON.stringify(et || '')].join('|');
  function celda(p, et, nc) {
    const n = nc.get(p.pid) || 0, im = p.imagenes[0];
    return h('button', { type: 'button', class: 'cel' + (im ? '' : ' vacia'), 'data-pid': p.pid, 'aria-label': `${TIPO[p.tipo] || 'Publicación'} · ${fechaPub(p)} · ${ESTADO[p.estado][0]}`, onclick: () => abrir(p.pid) },
      im ? h('img', { alt: '', 'data-ruta': im.mini, loading: 'lazy', decoding: 'async' }) : h('span', { class: 'pre', text: p.estado === 'preparando' ? 'En preparación' : 'Sin imagen aún' }),
      p.tipo === 'carrusel' ? h('span', { class: 'ty' }, ico('copy')) : /reel/.test(p.tipo) ? h('span', { class: 'ty' }, ico('clap')) : null,
      et ? h('span', { class: 'mes-et', text: et }) : null,   // el mes, en su casilla más nueva (como la «Vista cliente»)
      n ? h('span', { class: 'nc' }, ico('msg'), String(n), h('span', { class: 'sr', text: n === 1 ? ' comentario' : ' comentarios' })) : null);
  }
  // el feed seguido (feed continuo): todos los meses del cliente, del más nuevo al más viejo, cada uno con todo lo suyo que Kevin
  // envió (en el orden de su tablero, `orden`), uno detrás de otro sin empezar fila; la etiqueta del mes, solo en su casilla más
  // nueva. Un mes sin publicaciones (solo una sesión o una entrega) no tiene sitio en el feed. [{m, items: [{p, et}]}]
  function feedGrupos() {
    const L = visibles(), por = new Map();
    for (const p of L) { if (!por.has(p.mes)) por.set(p.mes, []); por.get(p.mes).push(p); }
    return [...por.keys()].sort().reverse().map(m => ({ m, items: por.get(m).sort((a, b) => a.orden - b.orden).map((p, i) => ({ p, et: i ? null : mesEt(m) })) }));
  }
  function limpiarFeed() { const F = st.feed; if (F) { if (F.ro) F.ro.disconnect(); if (F.mov) F.mov.destruir(); } st.feed = null; }
  function feedNodo() {
    let F = st.feed;
    if (!F || F.cli !== st.cli) {
      const grid = h('div', { class: 'feed' }), vacio = h('p', { class: 'vacio', text: 'Aún no hay publicaciones.' }), sc = h('div', { class: 'fm-sc' });
      const cab = FeedMov.cabecera({ icono: n => ico(n), alPulsar: k => irMes(k) });
      const host = h('div', { class: 'fm-host' }, cab.nodo, h('div', { class: 'fm-svh', 'aria-hidden': 'true' }));
      F = st.feed = { cli: st.cli, envs: new Map(), grid, vacio, sc, host, cab, puesto: false, arriba: !!st.abrirArriba, nodo: h('section', { class: 'feedw', 'aria-label': 'Tu feed' }, host, sc) };
    }
    const G = feedGrupos(), nc = cuentaComs(), vivos = new Set(); let ant = null;
    for (const g of G) {
      vivos.add(g.m);
      let E = F.envs.get(g.m); const ids = g.items.map(x => x.p.pid).join(',');
      if (!E || E.ids !== ids) {   // ese mes cambió de publicaciones (o de orden): se rehace solo él
        const sigs = new Map(), n = h('div', { class: 'fm-m', 'data-mes': g.m }, g.items.map(x => { sigs.set(x.p.pid, sigCelda(x.p, x.et, nc)); return celda(x.p, x.et, nc); }));
        if (E) E.nodo.replaceWith(n);
        F.envs.set(g.m, E = { nodo: n, ids, sigs });
      } else for (const x of g.items) {   // el mismo mes: solo la casilla que cambió
        const s = sigCelda(x.p, x.et, nc); if (E.sigs.get(x.p.pid) === s) continue;
        const v = E.nodo.querySelector(`.cel[data-pid="${CSS.escape(x.p.pid)}"]`); if (v) v.replaceWith(celda(x.p, x.et, nc)); E.sigs.set(x.p.pid, s);
      }
      const aqui = ant ? ant.nextSibling : F.grid.firstChild;
      if (E.nodo !== aqui) F.grid.insertBefore(E.nodo, aqui);
      ant = E.nodo;
    }
    for (const [m, E] of F.envs) if (!vivos.has(m)) { E.nodo.remove(); F.envs.delete(m); }
    const dentro = G.length ? F.grid : F.vacio;
    if (F.sc.firstChild !== dentro || F.sc.childNodes.length !== 1) F.sc.replaceChildren(dentro);
    return F.nodo;
  }
  // ---------- la cabecera de meses y dónde está el feed ----------
  // los meses de la cabecera, del más viejo al más nuevo: los que tienen publicaciones y los que solo tienen una sesión o una
  // entrega (se eligen, pero no tienen sitio en el feed); un mes sin nada entre dos enviados, escondido (no llega)
  const feedMeses = () => mesesDisponibles().slice().sort().map(m => ({ key: m, label: mesEt(m), title: may(MESES[+m.slice(5, 7) - 1]) + ' ' + m.slice(0, 4) }));
  // quién desliza el feed: a pantalla completa, su panel; si no, la página (opción B)
  const feedModo = () => (app.querySelector('.pv.lleno') ? 'el' : 'win');
  // el punto de un mes: la posición en la que su primera publicación (la más vieja) queda en la fila de abajo de lo que se ve;
  // null: el mes no tiene casillas. Con la página, el alto pequeño de la pantalla (100svh: la barra de Safari no lo mueve)
  function feedPunto(key, modo) {
    const F = st.feed, E = F && F.envs.get(key), c = E && E.nodo.lastElementChild; if (!c) return null;
    const b = c.getBoundingClientRect().bottom;
    if ((modo || feedModo()) === 'el') { const sc = F.sc, max = sc.scrollHeight - sc.clientHeight; return Math.max(0, Math.min(max, Math.round(sc.scrollTop + b - sc.getBoundingClientRect().top - sc.clientHeight))); }
    const vh = F.host.querySelector('.fm-svh').offsetHeight || innerHeight, max = document.documentElement.scrollHeight - innerHeight;
    return Math.max(0, Math.min(max, Math.round(scrollY + b - vh + 8)));
  }
  // ---------- el movimiento (feed continuo; el motor de la Mesa, feed-mov.js) ----------
  // La tira sigue al feed; el mes activo cambia una vez, al asentarse; el imán suave; pulsar un mes o una flecha, un salto de
  // duración fija (--d-m, --ease-m); con «reducir movimiento», todo al instante y sin imán. Un motor por cliente y por quien
  // desliza (el panel o la página): al cruzar 1100 px o 700 de alto se monta otro y el feed vuelve al punto de su mes.
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const mesNo = () => !!(st.abierta || document.querySelector('.dlg'));   // con la ventana o un diálogo abiertos, el mes activo no cambia
  // con la página, mirando lo de debajo del feed (calendario, «Tus pagos»): ni el mes activo cambia ni actúa el imán
  const pasado = () => { const F = st.feed; return !!(F && F.movModo === 'win' && F.ultimo != null && scrollY > F.ultimo + 1); };
  function movMontar() {
    const F = st.feed; if (!F || !F.nodo.isConnected) return false;
    const modo = feedModo(); if (F.mov && F.movModo === modo) return false;
    if (F.mov) F.mov.destruir();
    const tk = FeedMov.tokens();
    F.movModo = modo;
    F.mov = FeedMov.motor(modo === 'el' ? F.sc : FeedMov.ventana(), {
      pintar: v => F.cab.mover(v), jFijo: () => Math.max(0, F.cab.indice(st.mes)), reducir: () => !!RM.matches,
      imanNo: () => mesNo() || pasado(), asentado: v => seguro(() => movAsentado(v)), dur: tk.dur, ease: tk.ease });
    return true;
  }
  // los puntos de los meses (una lectura de diseño: al montar y cuando cambian el tamaño o el contenido, nunca al deslizar)
  function movMedir() {
    const F = st.feed; if (!F || !F.mov || !F.nodo.isConnected) return;
    const pts = []; F.cab.meses().forEach((m, j) => { const p = feedPunto(m.key, F.movModo); if (p != null) pts.push({ j, st: p }); });
    const c0 = F.grid.querySelector('.cel'), fh = c0 ? c0.offsetHeight + 2 : 0;
    const max = F.movModo === 'el' ? F.sc.scrollHeight - F.sc.clientHeight : document.documentElement.scrollHeight - innerHeight;
    F.ultimo = pts.length ? Math.max(...pts.map(p => p.st)) : null;
    F.mov.medir(pts, fh, Math.max(0, max), F.mov.sc.scrollTop);
  }
  // el feed en el mes activo, al instante (al abrir, al cambiar quién desliza); un mes sin casillas: el feed en el más cercano y la
  // tira en el suyo
  function feedColocar() {
    const F = st.feed; if (!F || !F.mov) return;
    const ms = F.cab.meses().map(m => m.key), j = ms.indexOf(st.mes); let jn = -1, y = null;
    for (let d = 0; d < ms.length && y == null; d++) for (const k of [j + d, j - d]) { if (k < 0 || k >= ms.length) continue; const p = feedPunto(ms[k], F.movModo); if (p != null) { jn = k; y = p; break; } }
    if (y == null) return;
    F.mov.ir(y, jn, { instantaneo: true }); if (jn !== j && j >= 0) F.mov.volver(j, true);
  }
  // la cabecera, al día: sus meses y el activo; colocada sobre la rejilla; la primera vez, el feed en el punto de su mes
  function cabPoner() {
    const F = st.feed; if (!F) return;
    const antes = F.cab.meses().map(m => m.key);
    if (F.cab.poner(feedMeses()) && F.mov) { const ahora = F.cab.meses().map(m => m.key); F.mov.reindex(j => ahora.indexOf(antes[j])); }
    F.cab.marcar(st.mes);
    if (!F.ro && typeof ResizeObserver === 'function') { F.ro = new ResizeObserver(() => seguro(cabColocar)); [F.grid, F.host, F.sc, document.body].forEach(e => F.ro.observe(e)); }
    movMontar(); cabColocar();
    if (!F.puesto) {   // la primera vez: el feed en el punto de su mes o, con algo por aprobar y la página deslizando, arriba del todo
      F.puesto = true; st.abrirArriba = false;
      if (F.arriba && F.movModo === 'win') { if (scrollY) window.scrollTo(0, 0); movMedir(); } else feedColocar();
    } else movActivo();
  }
  function cabColocar() { const F = st.feed; if (!F || !F.nodo.isConnected) return; F.cab.colocar(F.grid); movMedir(); }
  // en reposo, la tira en el mes activo (si tocaste una publicación de otro mes o el mes no pudo cambiar): vuelve sola, sin mover el feed
  function movActivo() { const F = st.feed, i = F ? F.cab.indice(st.mes) : -1; if (!F || !F.mov || i < 0 || !F.mov.quieto()) return; if (Math.abs(F.mov.v() - i) > 0.002) F.mov.volver(i); }   // en reposo, el nombre del mes activo entero y centrado en la píldora, también entre dos puntos; el feed no se mueve (D-338 de la Mesa; D-P14)
  // el desplazamiento se asentó en v: el mes activo, una vez, al del mes con casillas más cercano (un empate: el más nuevo); nada
  // se escribe; solo cambia lo que cuelga del mes
  function movAsentado(v) {
    const F = st.feed; if (!F || pasado()) return;
    const ms = F.cab.meses(); let b = -1;
    ms.forEach((m, j) => { if (F.envs.has(m.key) && (b < 0 || Math.abs(j - v) < Math.abs(b - v) || (Math.abs(j - v) === Math.abs(b - v) && j > b))) b = j; });
    if (b >= 0 && ms[b].key !== st.mes && !mesNo()) { st.mes = ms[b].key; pintarMes(); F.cab.marcar(st.mes); }
    movActivo();
  }
  function feedA(p, llevar) {
    const F = st.feed; if (!F || !F.mov) return;
    const ms = mesesDisponibles();
    if (p.mes !== st.mes && ms.includes(p.mes)) { st.mes = p.mes; pintarMes(); F.cab.marcar(p.mes); }
    const c = F.grid.querySelector(`.cel[data-pid="${CSS.escape(p.pid)}"]`), j = F.cab.indice(p.mes);
    if (!llevar || !c) { movActivo(); return; }
    const r = c.getBoundingClientRect(), el = F.movModo === 'el';
    const arriba = el ? F.sc.getBoundingClientRect().top : F.host.getBoundingClientRect().bottom, abajo = el ? F.sc.getBoundingClientRect().bottom : (F.host.querySelector('.fm-svh').offsetHeight || innerHeight) - 8;
    const s = F.mov.sc.scrollTop, max = el ? F.sc.scrollHeight - F.sc.clientHeight : document.documentElement.scrollHeight - innerHeight;
    const d = r.top < arriba ? r.top - arriba : r.bottom > abajo ? r.bottom - abajo : 0;
    if (Math.abs(d) < 1) { movActivo(); return; }
    F.mov.ir(Math.max(0, Math.min(max, Math.round(s + d))), j, { libre: true });
  }
  // pulsar un mes o una flecha: el mes activo al momento; el feed, con el salto, a su punto (un mes sin casillas: el feed no se mueve)
  function irMes(key) {
    const F = st.feed; if (!F) return;
    if (key !== st.mes) { st.mes = key; pintarMes(); }
    F.cab.marcar(key); movMontar();
    const j = F.cab.indice(key), y = feedPunto(key, F.movModo);
    if (y != null) F.mov.ir(y, j); else F.mov.volver(j);
  }
  // Las entregas de un cliente de solo contenido (D-297), en el sitio del feed: las del mes, «N de M entregadas»; cada una con
  // qué, cuánto y su fecha; entregada, su enlace (solo entonces) y el día; si no, «En camino»; las del mes siguiente, aparte.
  // «qué» y «cuánto» pasaron en la Mesa el mismo filtro que los captions (mesOtros). Como la «Vista cliente» (entregas.js).
  function filaEnt(e) {
    const hecha = !!e.entregada, sub = [e.cuanto, hecha ? 'entregada el ' + diaCorto(e.entregada) : 'antes del ' + diaCorto(e.fecha)].filter(Boolean).join(' · ');
    const der = hecha && /^https:\/\/\S+$/.test(e.enlace || '') ? h('a', { class: 'ent-l', href: e.enlace, target: '_blank', rel: 'noopener noreferrer' }, ico('ext'), 'Abrir')
      : hecha ? null : h('span', { class: 'ent-cam', text: 'En camino' });
    return h('li', { class: 'ent-f' + (hecha ? ' hecha' : ''), 'data-ent': e.id }, h('span', { class: 'd', text: diaCorto(e.fecha) }), h('span', { class: 't' }, h('b', { text: e.que }), h('span', { text: sub })), der);
  }
  // Todas, sin meses (D-312): lo que viene por fecha («En camino»); aparte, las entregadas de la más nueva a la más vieja por el mes
  // de su fecha; debajo, las sesiones y reuniones que vienen. La misma lista que la «Vista cliente» de la Mesa (entregas.js)
  const filaSes = x => h('li', { class: 'ent-f ent-ses' }, h('span', { class: 'd' }, ico(reu(x) ? 'users' : 'clap'), diaCorto(diaDe(x.inicio))),
    h('span', { class: 't' }, h('b', { text: x.nombre }), h('span', { text: [reu(x) ? 'Reunión' : 'Sesión', x.sin_hora ? '' : horaDe(x.inicio)].filter(Boolean).join(' · ') })));
  function pintarEntregas() {
    const E = (st.d.ents || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id)), H = hoy();
    const pend = E.filter(e => !e.entregada), hechas = E.filter(e => e.entregada).sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.entregada).localeCompare(String(a.entregada)) || a.id.localeCompare(b.id));
    const grupos = []; for (const e of hechas) { const m = e.fecha.slice(0, 7), g = grupos[grupos.length - 1]; if (g && g.m === m) g.l.push(e); else grupos.push({ m, l: [e] }); }
    const ses = (st.d.ses || []).filter(x => x.inicio && diaDe(x.fin || x.inicio) >= H).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id));
    const cuenta = [pend.length ? `${pend.length} en camino` : '', hechas.length ? `${hechas.length} entregada${hechas.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
    return h('section', { class: 'card entw', 'aria-labelledby': 'h-ent' },
      h('div', { class: 'ti' }, h('h2', { id: 'h-ent', text: 'Tus entregas' }), cuenta ? h('span', { text: cuenta }) : null),
      st.d.entsMal ? h('p', { class: 'vacio', text: 'No se pudieron cargar tus entregas: vuelve a abrir la página en un momento.' })
        : [pend.length ? h('ol', { class: 'ents' }, pend.map(filaEnt)) : hechas.length ? null : h('p', { class: 'vacio', text: 'Aún no hay entregas.' }),
          grupos.map(g => [h('p', { class: 'h3', text: may(MESES[+g.m.slice(5, 7) - 1]) + ' ' + g.m.slice(0, 4) }), h('ol', { class: 'ents' }, g.l.map(filaEnt))])],
      ses.length ? [h('p', { class: 'h3', text: 'Sesiones y reuniones' }), h('ol', { class: 'ents' }, ses.map(filaSes))] : null);
  }
  // ---------- un esporádico (D-378): sus sesiones, su calendario, sus tareas y notas, y la hoja de una sesión ----------
  // Lo mismo que su «Vista cliente» en la Mesa (sesiones.js): sus sesiones (Próximas y Pasadas) con su calendario debajo, sus tareas
  // y notas para leer y «Tus pagos»; una sesión se abre en una hoja con lo que tiene visible y su conversación al pie.
  const C_CS = 'id,cliente_id,sesion,texto,autor_nombre,de_kevin,hora,resuelto';
  const ultDiaSes = x => diaDe(x.fin || x.inicio);
  const icoSes = x => x.clase === 'foto' ? 'camera' : x.clase === 'video' ? 'video' : x.clase === 'libre' ? 'file' : reu(x) ? 'users' : 'clap';   // its kind's, as the Mesa's
  const tramoSes = x => { const d = diaDe(x.inicio), f = x.fin ? diaDe(x.fin) : d, ho = x.sin_hora ? '' : ' · ' + horaDe(x.inicio);
    return f !== d ? `${dsem(d).slice(0, 3)} ${diaCorto(d)}${ho} – ${dsem(f).slice(0, 3)} ${diaCorto(f)}` : `${dsem(d).slice(0, 3)} ${diaCorto(d)}${ho}`; };
  function pintarSesEsp() {
    const H = hoy(), l = (st.d.ses || []).filter(x => x.inicio).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id));
    const prox = l.filter(x => ultDiaSes(x) >= H), pas = l.filter(x => ultDiaSes(x) < H).reverse();
    const fila = x => { const n = (st.d.cses || []).filter(c => c.sesion === x.id).length, nt = n === 1 ? '1 comentario' : n + ' comentarios';
      return h('li', {}, h('button', { type: 'button', class: 'ent-f es-r', 'data-ses': x.id, onclick: e => abrirSes(x.id, e.currentTarget), 'aria-label': `${reu(x) ? 'Reunión' : 'Sesión'}: ${x.nombre} · ${tramoSes(x)}${n ? ' · ' + nt : ''}` },
        h('span', { class: 'd', text: tramoSes(x) }), ico(icoSes(x), 'es-i'),
        h('span', { class: 't' }, h('b', { text: x.nombre }), n ? h('span', { class: 'es-n', text: nt }) : null))); };
    const grupo = (t, g) => g.length ? [h('p', { class: 'h3' }, t + ' ', h('span', { text: String(g.length) })), h('ol', { class: 'ents es-l' }, g.map(fila))] : null;
    return h('div', { class: 'es-col' },
      h('section', { class: 'card entw', 'aria-labelledby': 'h-ses' }, h('div', { class: 'ti' }, h('h2', { id: 'h-ses', text: 'Tus sesiones' })),
        l.length ? [grupo('Próximas', prox), grupo('Pasadas', pas)] : h('p', { class: 'vacio', text: 'Aún no hay sesiones.' })),
      h('section', { class: 'card es-calw', 'aria-label': 'Calendario' }, calEsp()));
  }
  function calEsp() {
    const m = st.mesEsp || (st.mesEsp = hoy().slice(0, 7)), [y, mo] = m.split('-').map(Number), d0 = new Date(Date.UTC(y, mo - 1, 1)), dias = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const lun = (d0.getUTCDay() + 6) % 7, H = hoy(), ses = (st.d.ses || []).filter(x => x.inicio);
    const deDia = d => ses.filter(x => diaDe(x.inicio) <= d && ultDiaSes(x) >= d).sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map(x => h('button', { type: 'button', class: 'chip ses es-c' + (reu(x) ? ' reu' : ''), onclick: e => abrirSes(x.id, e.currentTarget), 'aria-label': `${x.nombre} · ${tramoSes(x)}` },
        h('span', { class: 'cl' }, ico(reu(x) ? 'users' : 'clap', 'cses'), h('span', { class: 'cn', text: x.nombre })), x.sin_hora || diaDe(x.inicio) !== d ? null : h('span', { class: 'ct', text: horaDe(x.inicio) })));
    const celdas = [], diasAntes = new Date(Date.UTC(y, mo - 1, 0)).getUTCDate();
    for (let i = 0; i < lun; i++) celdas.push(h('div', { class: 'dia fuera', 'aria-hidden': 'true' }, h('span', { class: 'n', text: String(diasAntes - lun + 1 + i) })));
    for (let d = 1; d <= dias; d++) { const dia = `${m}-${String(d).padStart(2, '0')}`; celdas.push(h('div', { class: 'dia' + (dia === H ? ' hoy' : '') }, h('span', { class: 'n', text: d === 1 ? `1 ${MESES[mo - 1].slice(0, 3)}` : String(d) }), deDia(dia))); }
    for (let d = 1; celdas.length % 7; d++) celdas.push(h('div', { class: 'dia fuera', 'aria-hidden': 'true' }, h('span', { class: 'n', text: d === 1 ? `1 ${MESES[mo % 12].slice(0, 3)}` : String(d) })));
    const ir = k => { const [a, b] = st.mesEsp.split('-').map(Number), n = new Date(Date.UTC(a, b - 1 + k, 1)); st.mesEsp = n.toISOString().slice(0, 7); const w = document.querySelector('.es-calw'); if (w) w.replaceChildren(...calEsp()); };
    return [h('div', { class: 'ti es-cal-h' }, h('h2', { text: 'Calendario' }), h('span', { class: 'es-nav' }, h('button', { type: 'button', class: 'es-mes', 'aria-label': 'Mes anterior', onclick: () => ir(-1) }, ico('left')), h('b', { text: may(MESES[mo - 1]) + ' ' + y }), h('button', { type: 'button', class: 'es-mes', 'aria-label': 'Mes siguiente', onclick: () => ir(1) }, ico('right')))),
      h('div', { class: 'cal es-cal', role: 'grid', 'aria-label': 'Calendario de ' + MESES[mo - 1] }, ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => h('span', { class: 'dn', 'aria-hidden': 'true', text: x })), celdas)];
  }
  function pintarTN() {
    const tn = st.d.tn || [], tk = tn.filter(x => x.tipo === 'tarea'), ns = tn.filter(x => x.tipo === 'nota');
    return h('section', { class: 'card es-tn', 'aria-labelledby': 'h-tn' }, h('div', { class: 'ti' }, h('h2', { id: 'h-tn', text: 'Tareas' }), h('span', { text: String(tk.length) })),
      tk.length ? h('ol', { class: 'es-tl' }, tk.map(x => h('li', { class: 'es-t' + (x.hecha ? ' hecha' : '') }, h('span', { class: 'd', text: x.fecha ? diaCorto(x.fecha) : '' }), h('span', { class: 'x', text: x.texto })))) : h('p', { class: 'vacio', text: 'Sin tareas.' }),
      h('div', { class: 'ti es-ti2' }, h('h2', { text: 'Notas' }), h('span', { text: String(ns.length) })),
      ns.length ? ns.map(x => h('div', { class: 'es-nota' }, texto(x.texto))) : h('p', { class: 'vacio', text: 'Sin notas.' }));
  }
  // un texto con sus marcas, como lo enseña la Mesa a quien lo lee (escritura.js, «vineta»): viñetas, números, sangrías, separadores
  // y enlaces que se abren aparte; todo con textContent
  const MARCA = /^((?:  )*)(-|\d{1,3}\.|\[[ xX]?\])( )/, URLS = /\bhttps?:\/\/[^\s<>"«»]+/g;
  function conEnlaces(t) {
    const out = []; let i = 0, m; URLS.lastIndex = 0;
    while ((m = URLS.exec(t))) { let u = m[0]; const c = /[.,;:!?)\]'”’]+$/.exec(u); if (c) u = u.slice(0, -c[0].length); if (u.length > 8) { out.push(t.slice(i, m.index), h('a', { href: u, target: '_blank', rel: 'noopener noreferrer', text: u })); i = m.index + u.length; } URLS.lastIndex = m.index + Math.max(1, u.length); }
    out.push(t.slice(i)); return out.filter(x => x !== '');
  }
  function texto(t) {
    const L = String(t || '').split('\n'); while (L.length && !L[L.length - 1].trim()) L.pop();
    return h('div', { class: 'es-tx' }, L.map(l => {
      if (l.trim() === '\u2E3B') return h('hr', { class: 'es-sep' });
      const m = MARCA.exec(l); if (!m) return h('p', { class: l ? null : 'vacia' }, conEnlaces(l));
      const k = m[2], nu = /^\d/.test(k), niv = Math.min(4, m[1].length / 2);
      return h('p', { class: 'li' + (nu ? ' nu' : '') + (niv ? ' n' + niv : '') }, h('span', { class: 'mk', 'aria-hidden': 'true', text: nu ? k : '•' }), h('span', { class: 'lt' }, conEnlaces(l.slice(m[0].length))));
    }));
  }
  function abrirSes(id, origen) {
    if (document.querySelector('.dlg')) return;
    const x = (st.d.ses || []).find(y => y.id === id); if (!x) return;
    st.sesAb = id;
    const velo = h('div', { class: 'velo alto' });
    const quitar = () => { velo.remove(); dlg.remove(); st.sesAb = null; if (st.sucio) { st.sucio = false; pintar(); } const o = origen && origen.isConnected ? origen : document.querySelector(`[data-ses="${CSS.escape(id)}"]`); if (o) o.focus(); };
    const fotos = [];
    const foto = f => { if (!f || !f.mini) return null; const im = h('img', { class: 'es-fo', alt: '', 'data-grande': f.mini, loading: 'lazy' }); if (f.an && f.al) { im.width = f.an; im.height = f.al; } fotos.push(im); return im; };
    const plano = it => h('div', { class: 'es-it' }, h('b', { text: it.titulo }), it.texto ? texto(it.texto) : null, (it.fotos || []).length ? h('div', { class: 'es-fos' }, it.fotos.map(foto)) : null,
      (it.enlaces || []).length ? h('p', { class: 'es-en' }, it.enlaces.map(u => h('a', { href: u, target: '_blank', rel: 'noopener noreferrer', text: u.replace(/^https?:\/\//, '') }))) : null);
    const ap = a => a.tipo === 'planos' ? (a.pestanas || []).map(p => h('section', { class: 'es-ap' }, h('h3', { text: p.nombre }), (p.items || []).map(plano)))
      : h('section', { class: 'es-ap' }, h('h3', { text: a.nombre }),
      a.tipo === 'mood' ? (a.grupos || []).map(g => h('div', { class: 'es-g' }, h('p', { class: 'es-pt', text: g.nombre }), h('div', { class: 'es-fos' + (g.modo === 'columnas' ? ' col' : '') }, (g.fotos || []).map(foto))))
      : a.tipo === 'material' ? (a.familias || []).map(f => h('div', { class: 'es-g' }, h('p', { class: 'es-pt', text: f.nombre }), h('ul', { class: 'es-ma' }, f.cosas.map(k => h('li', { text: k })))))
      : texto(a.texto));
    const hilo = () => { const l = (st.d.cses || []).filter(c => c.sesion === id); return l.length ? h('ol', {}, l.map(c => h('li', { class: 'cm' + (c.de_kevin ? ' kv' : '') }, h('span', { class: 'q' }, h('b', { text: c.de_kevin ? 'Uribe Visuals' : c.autor_nombre }), cuando(c.hora)), h('p', { text: c.texto })))) : h('p', { class: 'vacio', text: 'Aún sin comentarios.' }); };
    const caja = h('div', { class: 'es-hilo' }, hilo());
    const mira = soloMira(), k = 'portal-borrador-s-' + id;
    const ta = h('textarea', { rows: '1', placeholder: mira ? 'Solo mirar: aquí no se comenta' : 'Escribe un comentario…', 'aria-label': 'Comentario', maxlength: '2000', disabled: mira, title: mira ? POR : null });
    if (!mira) ta.value = lsGet(k) || '';
    const env = h('button', { type: 'button', class: 'env', 'aria-label': 'Enviar comentario', disabled: mira || !ta.value.trim(), title: mira ? POR : null }, ico('send'));
    const err = h('p', { class: 'err-p', role: 'alert', hidden: true });
    ta.addEventListener('input', () => { if (mira) return; lsSet(k, ta.value); env.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; });
    env.addEventListener('click', async () => {
      const t = ta.value.trim(); if (!t || soloMira()) return; env.disabled = true; err.hidden = true;
      try {
        st.gen++;
        const fila = await S.insertar(`comentarios_sesion?select=${C_CS}`, [{ cliente_id: st.cli, sesion: id, texto: t }], { devolver: true });
        st.gen++; st.d.cses = [...(st.d.cses || []), ...(fila || [])]; ta.value = ''; lsSet(k, null); ta.style.height = '';
        caja.replaceChildren(hilo()); caja.lastElementChild && caja.scrollIntoView({ block: 'end' }); st.sucio = true;
      } catch (e) { err.textContent = msgError(e); err.hidden = false; env.disabled = false; }
    });
    const cont = x.contenido || [];
    const dlg = h('section', { class: 'dlg es-hoja', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'h-hs' },
      h('button', { type: 'button', class: 'plan-x', 'aria-label': 'Cerrar', onclick: quitar }, ico('x')),
      h('div', { class: 'es-cab' }, h('h2', { id: 'h-hs', tabindex: '-1', text: x.nombre }), h('p', { text: [reu(x) ? 'Reunión' : 'Sesión', tramoSes(x)].join(' · ') })),
      h('div', { class: 'es-cue' }, cont.length ? cont.map(ap) : h('p', { class: 'vacio', text: 'Aún sin detalles.' }), h('div', { class: 'es-com' }, h('h3', { text: 'Comentarios' }), caja)),
      h('div', { class: 'es-pie' }, h('div', { class: 'escr' }, h('div', { class: 'fila' }, ta, env)), err));
    dlg._quitar = quitar; velo.addEventListener('click', quitar);
    document.body.append(velo, dlg);
    const xb = dlg.querySelector('.plan-x'); (xb.offsetParent ? xb : dlg.querySelector('#h-hs')).focus({ preventScroll: true });
    if (fotos.length) urls(fotos.map(i => i.dataset.grande)).then(m => { for (const i of fotos) if (m[i.dataset.grande] && i.isConnected) i.src = m[i.dataset.grande]; }).catch(e => toast('No se pudieron cargar las fotos: ' + msgError(e)));
  }
  async function otraVez(e) {   // una URL firmada que caducó antes de verse (perezosa): se pide de nuevo, una vez
    const i = e.currentTarget, r = i.dataset.ruta || i.dataset.grande; if (!r || i.dataset.otra) return;
    i.dataset.otra = '1'; st.urls.delete(r);
    try { const m = await urls([r]); if (m[r] && i.isConnected) i.src = m[r]; } catch (x) { /* se queda el hueco */ }
  }
  async function pintarMinis() {
    const imgs = [...app.querySelectorAll('img[data-ruta]:not([src])')], rutas = imgs.map(i => i.dataset.ruta);
    if (!rutas.length) return;
    try {
      const m = await urls(rutas);
      for (const i of imgs) if (m[i.dataset.ruta] && i.isConnected) { i.src = m[i.dataset.ruta]; i.addEventListener('error', otraVez, { once: true }); }
    } catch (e) { /* sin fotos: los huecos se quedan; el siguiente repaso lo vuelve a intentar */ }
  }

  // como la casilla del calendario de la «Vista cliente» de la Mesa (calendario.js): el nombre a la izquierda y la hora a la
  // derecha, en una línea si caben, sin marca de estado (la llevan el feed y la lista del móvil; aquí, en su aria-label) (D-246)
  function chip(p) {
    return h('button', { type: 'button', class: 'chip ' + p.tipo, 'data-pid': p.pid, onclick: () => abrir(p.pid), 'aria-label': `${p.nombre} · ${fechaPub(p)} · ${ESTADO[p.estado][0]}` },
      h('span', { class: 'cl' }, h('span', { class: 'cn', text: p.nombre })), p.sin_hora || !p.fecha ? null : h('span', { class: 'ct', text: horaDe(p.fecha) }));
  }
  const reu = x => x.clase === 'reunion';   // una reunión (D-297): su dibujo (Lucide «users») y su nombre, como una sesión
  const chipSes = x => h('span', { class: 'chip ses' + (reu(x) ? ' reu' : '') },
    h('span', { class: 'cl' }, ico(reu(x) ? 'users' : 'clap', 'cses'), h('span', { class: 'sr', text: (reu(x) ? 'Reunión' : 'Sesión') + ': ' }), h('span', { class: 'cn', text: x.nombre })), x.sin_hora ? null : h('span', { class: 'ct', text: horaDe(x.inicio) }));
  // una entrega en su día (D-297): entregada, con su ✓; si no, en camino
  const chipEnt = e => h('span', { class: 'chip entg' + (e.entregada ? ' hecha' : '') },
    h('span', { class: 'cl' }, e.entregada ? ico('check', 'cses') : null, h('span', { class: 'sr', text: 'Entrega: ' }), h('span', { class: 'cn', text: e.que }), h('span', { class: 'sr', text: e.entregada ? ', entregada' : ', en camino' })));
  function pintarCalendario() {
    const m = st.mes, [y, mo] = m.split('-').map(Number), d0 = new Date(Date.UTC(y, mo - 1, 1)), dias = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const lun = (d0.getUTCDay() + 6) % 7, H = hoy(), pubs = delMes(m).filter(p => p.fecha), ses = st.d.ses.filter(x => x.mes === m), ents = (st.d.ents || []).filter(e => e.fecha.slice(0, 7) === m);
    const deDia = d => [...pubs.filter(p => diaDe(p.fecha) === d).map(p => [p.fecha, chip(p)]), ...ses.filter(x => diaDe(x.inicio) === d).map(x => [x.inicio, chipSes(x)]), ...ents.filter(e => e.fecha === d).map(e => [e.fecha + 'T23:59', chipEnt(e)])].sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]);
    const celdas = [];
    const diasAntes = new Date(Date.UTC(y, mo - 1, 0)).getUTCDate();
    for (let i = 0; i < lun; i++) celdas.push(h('div', { class: 'dia fuera', 'aria-hidden': 'true' }, h('span', { class: 'n', text: String(diasAntes - lun + 1 + i) })));
    for (let d = 1; d <= dias; d++) { const dia = `${m}-${String(d).padStart(2, '0')}`; celdas.push(h('div', { class: 'dia' + (dia === H ? ' hoy' : '') }, h('span', { class: 'n', text: d === 1 ? `1 ${MESES[mo - 1].slice(0, 3)}` : String(d) }), deDia(dia))); }
    for (let d = 1; celdas.length % 7; d++) celdas.push(h('div', { class: 'dia fuera', 'aria-hidden': 'true' }, h('span', { class: 'n', text: d === 1 ? `1 ${MESES[mo % 12].slice(0, 3)}` : String(d) })));
    const grid = h('div', { class: 'cal', role: 'grid', 'aria-label': 'Calendario de ' + MESES[mo - 1] }, ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => h('span', { class: 'dn', 'aria-hidden': 'true', text: x })), celdas);
    // lista por semanas (a 390): de lunes a domingo
    const items = [...pubs.map(p => ({ t: p.fecha, p })), ...ses.map(x => ({ t: x.inicio, x })), ...ents.map(e => ({ t: madrid(e.fecha), e }))].sort((a, b) => a.t.localeCompare(b.t));
    const lista = h('ol', { class: 'agenda' }); let semAnt = null;
    for (const it of items) {
      const dia = diaDe(it.t), dd = new Date(dia + 'T12:00:00Z'), w = (dd.getUTCDay() + 6) % 7, lunes = new Date(dd - w * 864e5).toISOString().slice(0, 10), dom = new Date(dd.getTime() + (6 - w) * 864e5).toISOString().slice(0, 10);
      if (lunes !== semAnt) { semAnt = lunes; const n = Math.floor((+dia.slice(8) + lun - 1) / 7) + 1, mismo = lunes.slice(5, 7) === dom.slice(5, 7);
        lista.append(h('li', { class: 'sem', text: `Semana ${n} · ${mismo ? +lunes.slice(8) : diaCorto(lunes)} – ${diaCorto(dom)}` })); }
      const est = it.p ? (it.p.estado === 'por_aprobar' ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : ['aprobada', 'programada', 'publicada'].includes(it.p.estado) ? ico('check', 'ok') : it.p.estado === 'cambios' ? ico('pen', 'cb') : null) : it.e && it.e.entregada ? ico('check', 'ok') : null;
      const hora = it.p ? (it.p.sin_hora ? '' : horaDe(it.p.fecha)) : it.e ? '' : (it.x.sin_hora ? '' : horaDe(it.x.inicio));
      const cont = [h('span', { class: 'd' }, h('b', { text: String(+dia.slice(8)) }), h('span', { text: dsem(dia).slice(0, 3) })),
        h('span', { class: 'c ' + (it.p ? it.p.tipo : it.e ? 'entg' + (it.e.entregada ? ' hecha' : '') : 'ses' + (reu(it.x) ? ' reu' : '')), text: it.p ? it.p.nombre : it.e ? it.e.que : it.x.nombre }), h('span', { class: 'h', text: hora }), h('span', { class: 's' }, est)];
      lista.append(h('li', {}, it.p ? h('button', { type: 'button', class: 'ag', 'data-pid': it.p.pid, onclick: () => abrir(it.p.pid), 'aria-label': `${it.p.nombre} · ${fechaPub(it.p)} · ${ESTADO[it.p.estado][0]}` }, cont) : h('div', { class: 'ag' }, cont)));
    }
    if (!items.length) lista.append(h('li', {}, h('p', { class: 'vacio', text: 'Este mes aún no tiene nada en el calendario.' })));
    return [h('div', { class: 'cal-h', text: may(MESES[mo - 1]) + ' ' + y }), grid, lista];
  }
  function pintarPorque() {
    const r = st.d.meses.find(x => x.mes === st.mes && x.porque);
    if (r) return h('div', { class: 'pq' }, r.porque.partes.map(p => h('p', {}, h('b', { text: p.t + (/[.:?!]$/.test(p.t) ? '' : '.') }), ' ' + p.x)));
    return camino(`El porqué de ${MESES[+st.mes.slice(5, 7) - 1]} llega con su calendario.`);
  }
  const camino = t => h('div', { class: 'camino' }, ico('hourglass'), h('p', { style: null }, h('b', { text: 'En camino' }), t));
  function pintarCentro() {
    const ultimoPq = st.d.meses.filter(x => x.porque).map(x => x.mes).sort().pop() || '';
    const hayPq = st.d.meses.some(x => x.mes === st.mes && x.porque) || (ultimoPq && st.mes > ultimoPq);
    if (!hayPq && st.tab === 'pq') st.tab = 'cal';
    const tabs = hayPq ? h('div', { class: 'tabs', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', class: 'tab' + (st.tab === 'cal' ? ' on' : ''), 'aria-selected': String(st.tab === 'cal'), text: 'Calendario', onclick: () => { st.tab = 'cal'; pintarCentroSolo(); } }),
      h('button', { type: 'button', role: 'tab', class: 'tab' + (st.tab === 'pq' ? ' on' : ''), 'aria-selected': String(st.tab === 'pq'), text: 'Por qué este calendario', onclick: () => { st.tab = 'pq'; pintarCentroSolo(); } })) : null;
    return h('section', { class: 'card cent', 'data-tab': st.tab, 'aria-label': st.tab === 'pq' ? 'Por qué este calendario' : 'Calendario' }, tabs, st.tab === 'pq' ? h('div', { class: 'pq-w' }, pintarPorque()) : pintarCalendario());
  }
  // la pestaña «Calendario / Por qué»: solo esa columna; «Ver las anteriores»: solo «Tus pagos» (sin pintar la página)
  function pintarCentroSolo() { const v = app.querySelector('.cols > .cent'), n = seguro(pintarCentro); if (!v || !n) return pintar(); scrollCols(); v.replaceWith(n); scrollCols(true); }
  function pintarPagosSolo() { const v = app.querySelector('[data-p="pagos"]'), n = seguro(() => pintarPagos(st.clientes.find(c => c.id === st.cli))); if (!v || !n) return pintar(); scrollCols(); v.replaceWith(n); scrollCols(true); }
  function estadoPago(r, H) {
    if (r.cobrada) return ['Pagada', 'ok', 'check', 'pagada el ' + diaCorto(r.cobrada)];
    // como la Mesa (cobEstado): sin emisión ni vencimiento, o con la emisión más adelante, sin emitir; con solo «Vence», cuenta como emitida (D-368)
    if ((!r.emitida && !r.vence) || (r.emitida && r.emitida > H)) return ['Sin emitir', 'sin', 'clock', r.emitida ? 'se emite el ' + diaCorto(r.emitida) : ''];
    if (r.vence && r.vence < H) return ['Pendiente', 'ven', 'alert', 'venció el ' + diaCorto(r.vence)];
    return ['Pendiente', 'pen', 'clock', r.vence ? 'vence el ' + diaCorto(r.vence) : ''];
  }
  // «Tus pagos» con su tramo (D-297): con un acuerdo que no es mensual, «Pago semestral · 2700 €» y «Cubre may – oct 2026 · el
  // siguiente, el 1 nov»; cada factura por su tramo («Mayo – octubre»); nunca la fecha de renegociar (no llega). Como la Mesa.
  const PAGO = { trimestral: 'Pago trimestral', semestral: 'Pago semestral', anual: 'Pago anual', unico: 'Pago único' };
  const mesC = m => MESES[+m.slice(5, 7) - 1].slice(0, 3);
  const tramoTxt = (de, ha) => de === ha ? `${mesC(de)} ${de.slice(0, 4)}` : de.slice(0, 4) === ha.slice(0, 4) ? `${mesC(de)} – ${mesC(ha)} ${ha.slice(0, 4)}` : `${mesC(de)} ${de.slice(0, 4)} – ${mesC(ha)} ${ha.slice(0, 4)}`;
  const nomFactura = r => {   // «Noviembre», «Mayo – octubre», «Noviembre 2026 – abril 2027» (el año, si no es el de hoy)
    const p = r.periodo, ha = r.hasta && r.hasta > p ? r.hasta : p, hy = hoy().slice(0, 4), M = (m, y) => MESES[+m.slice(5, 7) - 1] + (y ? ' ' + m.slice(0, 4) : '');
    return may(ha === p ? M(p, p.slice(0, 4) !== hy) : p.slice(0, 4) !== ha.slice(0, 4) ? `${M(p, true)} – ${M(ha, true)}` : `${M(p, false)} – ${M(ha, ha.slice(0, 4) !== hy)}`);
  };
  function pintarPagos(cli) {
    const P = st.d.pagos, H = hoy(), clave = r => r.emitida || (/^\d{4}-\d{2}$/.test(r.periodo || '') ? r.periodo + '-01' : '') || r.vence || '';
    const orden = (a, b) => clave(b).localeCompare(clave(a)) || String(b.id).localeCompare(String(a.id));
    const deber = P.filter(r => !r.cobrada && estadoPago(r, H)[1] !== 'sin').sort((a, b) => clave(a).localeCompare(clave(b)));
    const pagadas = P.filter(r => r.cobrada).sort(orden), N = Math.max(0, pagadas.length - 3), ver = st.verAnt === st.cli;
    const prox = cli && /^\d{4}-\d{2}-\d{2}$/.test(cli.proxima_emision || '') ? cli.proxima_emision : '';   // también una que ya tocaba (D-308)
    const tramo = cli && cli.pago && cli.pago !== 'mensual' && cli.pago_cent != null;
    if (!(cli && cli.cuota_cent) && !tramo && !deber.length && !pagadas.length && !prox) return null;
    const filas = [...deber, ...pagadas.slice(0, 3), ...(ver ? pagadas.slice(3) : [])], venc = deber.filter(r => r.vence && r.vence < H).length;
    const fila = r => {
      const [t, k, i, cuando] = estadoPago(r, H), titulo = (r.periodo ? nomFactura(r) : (r.concepto || 'Factura')) + ' · ' + eur(r.importe_cent);
      return h('button', { type: 'button', class: 'fac', disabled: !r.pdf, 'aria-label': r.pdf ? `${titulo}: abrir la factura en PDF` : null, onclick: r.pdf ? () => abrirPdf(r.pdf) : null },
        h('div', {}, h('b', { text: titulo }), r.factura ? h('span', { class: 'm' }, r.pdf ? ico('file') : null, 'Factura ' + r.factura) : null, cuando ? h('span', { class: r.factura ? 'm2' : 'm', text: cuando }) : null),
        h('span', { class: 'est ' + k }, ico(i), t));
    };
    // la siguiente por su fecha, sin nombrar el mes: se emite el mes de antes (D-308); el acuerdo, de cuándo a cuándo
    // una fecha ya pasada, «en unos días» solo si es de hace poco: el portal tiene lo del último envío (revisión del lote B); sin partir
    // «1 abr 2027» ni «nov 2026», y un solo mes una vez
    const dia = d => diaCorto(d).replace(' ', '\u00a0') + (d.slice(0, 4) !== H.slice(0, 4) ? '\u00a0' + d.slice(0, 4) : ''), reciente = prox && prox < H && (Date.parse(H) - Date.parse(prox)) / 864e5 <= 10;
    const sig = prox ? (prox >= H ? 'el ' + dia(prox) : reciente ? 'en unos días' : '') : '';
    const mesA = m => `${mesC(m)}\u00a0${m.slice(0, 4)}`, rg = cli && /^\d{4}-\d{2}$/.test(cli.acuerdo_de || '') ? (/^\d{4}-\d{2}$/.test(cli.acuerdo_hasta || '') ? (cli.acuerdo_hasta === cli.acuerdo_de ? mesA(cli.acuerdo_de) : `${mesA(cli.acuerdo_de)} – ${mesA(cli.acuerdo_hasta)}`) : `desde ${mesA(cli.acuerdo_de)}`) : '';
    const emite = sig && !tramo ? h('p', { class: 'emite' }, ico('file'), `Próxima factura, ${sig}`) : null;   // con tramo, va en «Cubre …»
    const cubre = tramo && cli.cubre_de && cli.cubre_hasta ? h('p', { class: 'cubre' }, 'Cubre ', h('b', { text: tramoTxt(cli.cubre_de, cli.cubre_hasta) }), cli.pago !== 'unico' && prox && prox >= H ? ` · próxima factura, ${sig}` : '') : null;
    const inc = cli && Array.isArray(cli.incluye) && cli.incluye.length ? h('p', { class: 'incluye', text: 'Incluye ' + cli.incluye.join(' · ') }) : null;   // lo que incluye su paquete (D-307)
    const mas = N ? h('button', { type: 'button', class: 'lnk ver-ant', 'aria-expanded': String(ver), text: ver ? 'Ocultar las anteriores' : `Ver las anteriores (${N})`, onclick: () => { st.verAnt = ver ? null : st.cli; pintarPagosSolo(); } }) : null;
    // «Tu plan» (D-376): con un paquete, una línea —el título, su nombre (ninguno con «Personalizado») y «Qué incluye», que abre su
    // ficha: el precio, cómo se paga y de cuándo a cuándo, y sus tres listas—; sin paquete, «Tus pagos» como antes. Como la Mesa
    const plan = cli && cli.paquete ? cli.paquete : null, listas = plan ? [['incluye', 'Incluye', 'check', 'si'], ['no_incluye', 'No incluye', 'minus', 'no'], ['condiciones', 'Condiciones', null, 'c']].filter(([k]) => Array.isArray(cli[k]) && cli[k].length) : [];
    const ti = plan ? h('div', { class: 'ti pagos-ti tplan' }, h('h2', { id: 'h-pagos', text: 'Tu plan' }), plan !== 'Personalizado' ? h('span', { class: 'tp-n', text: plan }) : null,
      listas.length ? h('button', { type: 'button', class: 'tp-qi', 'aria-haspopup': 'dialog', onclick: ev => abrirPlan(cli, listas, rg, ev.currentTarget) }, 'Qué incluye', ico('right')) : null)
      : h('div', { class: 'ti pagos-ti' }, h('h2', { id: 'h-pagos', text: 'Tus pagos' }), tramo ? h('span', { text: `${PAGO[cli.pago] || 'Pago'} · ${eur(cli.pago_cent)}${rg ? ' · ' + rg + (cli.acuerdo_renueva ? ', se\u00a0renueva' : '') : ''}` }) : cli && cli.cuota_cent ? h('span', { text: eur(cli.cuota_cent) + ' al mes' + (rg ? ' · ' + rg : '') }) : null);
    return h('section', { class: 'card', 'aria-labelledby': 'h-pagos', 'data-p': 'pagos' },
      ti, plan ? (listas.length ? null : h('p', { class: 'cubre tp-pp', text: precioPlan(cli, rg) })) : inc, cubre,   // sin listas, su precio en su línea (no hay ficha que abrir)
      deber.length ? h('p', { class: 'pend-pago' }, 'Pendiente de pago ', h('b', { text: eur(deber.reduce((s, r) => s + r.importe_cent, 0)) }), venc ? h('em', { text: `· ${venc === 1 ? '1 vencida' : venc + ' vencidas'}` }) : null) : null,
      filas.map(fila), mas, emite);
  }
  // la ficha de «Tu plan» (D-376): centrada en el ordenador, con su ×; en el móvil sube desde abajo, con «Cerrar» a la vista
  const PAGO_PL = { mensual: 'pago mensual', trimestral: 'pago trimestral', semestral: 'pago semestral', anual: 'pago anual', unico: 'un solo pago' };
  function precioPlan(cli, rg) {
    const uno = cli.pago === 'unico', n = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }[cli.pago] || 1;
    const cuanto = cli.plan_mes_cent != null ? `${eur(cli.plan_mes_cent)}${cli.iva ? ' + IVA' : ''}${uno ? '' : ' al mes'}${cli.iva === 0 ? ' · sin IVA' : ''}` : cli.pago_cent != null ? `${eur(uno ? cli.pago_cent : Math.round(cli.pago_cent / n))}${uno ? '' : ' al mes'}` : '';
    return [cuanto, PAGO_PL[cli.pago] || '', rg].filter(Boolean).join(' · ');
  }
  function abrirPlan(cli, listas, rg, origen) {
    if (document.querySelector('.dlg')) return;
    const velo = h('div', { class: 'velo alto' });
    const quitar = () => {
      velo.remove(); dlg.remove();
      if (st.sucio) { st.sucio = false; pintar(); pintarHoja(); }   // lo que llegó mientras estaba abierta
      const o = origen && origen.isConnected ? origen : document.querySelector('.tp-qi'); if (o) o.focus();
    };
    const dlg = h('section', { class: 'dlg plan', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'h-plan' },
      h('button', { type: 'button', class: 'plan-x', 'aria-label': 'Cerrar', onclick: quitar }, ico('x')),
      h('h2', { id: 'h-plan', tabindex: '-1', text: cli.paquete === 'Personalizado' ? 'Tu plan' : cli.paquete }), h('p', { class: 'plan-pr', text: precioPlan(cli, rg) }),
      listas.map(([k, t, i, cl]) => h('div', { class: 'plan-g' }, h('h3', { text: t }), h('ul', { class: 'plan-l ' + cl }, cli[k].map(x => h('li', {}, i ? ico(i) : null, h('span', { text: x })))))),
      h('div', { class: 'fila' }, h('button', { type: 'button', class: 'btn s', text: 'Cerrar', onclick: quitar })));
    dlg._quitar = quitar; velo.addEventListener('click', quitar);
    document.body.append(velo, dlg);
    const x = dlg.querySelector('.plan-x'); (x.offsetParent ? x : dlg.querySelector('#h-plan')).focus({ preventScroll: true });   // en el móvil, el título: la hoja abre arriba
  }
  async function abrirPdf(ruta) {
    const w = window.open('', '_blank');   // abierta ya con el toque: si no, el móvil la bloquea («noopener» la devuelve nula)
    if (w) { try { w.opener = null; } catch (e) { /* ya sin opener */ } }
    try { const m = await urls([ruta], 'facturas'); if (!m[ruta]) throw new Error('no se pudo abrir la factura'); if (w) w.location.replace(m[ruta]); else location.href = m[ruta]; }
    catch (e) { if (w) w.close(); toast(msgError(e)); }
  }
  // «Ver más en Zernio» (D-294): justo bajo el título de «Cómo fue», siempre a la vista (lección 247); otra pestaña, sin decir
  // de dónde viene; solo un enlace https
  const zernio = cli => cli && /^https:\/\/\S+$/.test(cli.metricas || '') && cli.metricas.length <= 500
    ? h('a', { class: 'zernio', href: cli.metricas, target: '_blank', rel: 'noopener noreferrer' }, 'Ver más en Zernio', ico('ext')) : null;
  function pintarComoFue(cli) {
    const p = mesAntes(st.mes), r = st.d.meses.find(x => x.mes === p && x.resumen), ultimo = st.d.meses.filter(x => x.resumen).map(x => x.mes).sort().pop();
    if (!ultimo) return null;
    const cab = x => h('div', { class: 'ti' }, h('h2', { text: 'Cómo fue ' + mesNom(p) }), x ? h('span', { text: x }) : null);
    if (!r) {
      if (p >= hoy().slice(0, 7)) return h('section', { class: 'card', 'data-p': 'comofue' }, cab(''), zernio(cli), camino(`${may(MESES[+p.slice(5, 7) - 1])} aún no ha terminado: el resumen llega los primeros días de ${MESES[+st.mes.slice(5, 7) - 1]}.`));
      if (p > ultimo) return h('section', { class: 'card', 'data-p': 'comofue' }, cab(''), zernio(cli), camino(`El resumen de ${MESES[+p.slice(5, 7) - 1]} llega en unos días.`));
      return null;
    }
    const res = r.resumen, c = res.cifras, ant = mesAntes(p), n = c.publicaciones.valor;
    const fichas = [['alcance', 'Alcance'], ['interacciones', 'Interacciones'], ['guardados', 'Guardados'], ['publicaciones', 'Publicaciones']].map(([k, t]) => {
      const v = c[k].valor, d = cambio(v, c[k].anterior, ant);
      return h('div', {}, h('span', { text: t }), h('b', { text: cifra(v) }), h('em', { class: d.k, text: d.t }));
    });
    const P = res.posts || [], max = Math.max(1, ...P.map(x => x.alcance)), best = P.reduce((a, x, i) => x.alcance > P[a].alcance ? i : a, 0);
    const dato = h('p', { class: 'dato ayuda', 'aria-live': 'polite', text: 'Toca una barra para ver su dato.' });
    const ver = i => { const x = P[i]; dato.classList.remove('ayuda'); dato.textContent = `${x.nombre} · ${x.tipo} · ${diaCorto(x.fecha)} · ${num(x.alcance)} de alcance`; barras.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); };
    const barras = h('div', { class: 'barras', role: 'group', 'aria-label': `Alcance de cada publicación de ${MESES[+p.slice(5, 7) - 1]}: toca una para ver su dato` });
    barras.style.setProperty('--g', P.length > 40 ? '0.5px' : P.length > 24 ? '1px' : '2px');
    barras.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !e.buttons) return; const r = barras.getBoundingClientRect(); ver(Math.min(P.length - 1, Math.max(0, Math.floor((e.clientX - r.left) / Math.max(1, r.width) * P.length)))); });
    P.forEach((x, i) => {
      const bar = h('i'); bar.style.height = (x.alcance ? Math.max(2, x.alcance / max * 100) : 0).toFixed(1) + '%';
      if (i === best) { const lado = P.length === 1 ? 'medio' : i < P.length / 3 ? 'ini' : i > P.length * 2 / 3 ? 'fin' : 'medio'; bar.append(h('em', { class: 'lb ' + lado, text: (x.nombre.length > 26 ? x.nombre.slice(0, 25).trimEnd() + '…' : x.nombre) + ' · ' + cifra(x.alcance) })); }
      barras.append(h('button', { type: 'button', class: i === best ? 'top' : null, 'aria-pressed': 'false', 'aria-label': `${x.nombre}: ${num(x.alcance)} de alcance`, onclick: () => ver(i) }, bar));
    });
    const T = res.tipos || [], maxT = Math.max(1, ...T.map(t => t.alcance));
    return h('section', { class: 'card', 'aria-labelledby': 'h-comofue', 'data-p': 'comofue' },
      h('div', { class: 'ti' }, h('h2', { id: 'h-comofue', text: 'Cómo fue ' + mesNom(p) }), h('span', { text: n === 1 ? '1 publicación' : num(n) + ' publicaciones' })),
      zernio(cli), h('div', { class: 'cif' }, fichas), h('p', { class: 'sub', text: 'Frente a ' + MESES[+ant.slice(5, 7) - 1] }),
      P.length ? [h('p', { class: 'h3', text: 'Alcance de cada publicación' }), barras, h('div', { class: 'fechas' }, h('span', { text: diaCorto(P[0].fecha) }), P.length > 1 ? h('span', { text: diaCorto(P[P.length - 1].fecha) }) : null), dato] : null,
      T.length ? [h('p', { class: 'h3', text: 'Alcance medio por tipo' }), h('div', { class: 'tp' }, T.map(t => { const b = h('i'); b.style.width = Math.max(t.alcance ? 1 : 0, t.alcance / maxT * 100).toFixed(1) + '%'; return [h('span', { text: t.tipo }), h('span', {}, b), h('em', { text: cifra(t.alcance) })]; }))] : null,
      res.frase ? h('p', { class: 'frase', text: res.frase }) : null);
  }

  // ---------- una publicación ----------
  const borrador = pid => lsGet('portal-borrador-' + pid) || '';
  // abrir una publicación. Tocar una casilla de otro mes lo hace activo, sin mover el feed (como en la Mesa); «Revisarla» y
  // «Siguiente por aprobar» (llevar) lo hacen activo y llevan el feed, con el salto, hasta que su casilla se vea entera
  function abrir(pid, llevar) {
    const p = st.d.pubs.find(x => x.pid === pid && x.visible); if (!p) return;
    seguro(() => feedA(p, llevar));
    cerrar(true);
    st.abierta = { pid, slide: 1, origen: document.activeElement, version: null, tog: null };
    const velo = h('div', { class: 'velo', onclick: () => cerrar() });
    const hoja = h('section', { class: 'hoja', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'h-pub', tabindex: '-1' });
    document.body.append(velo, hoja); document.body.style.overflow = 'hidden'; document.body.classList.add('con-hoja');
    pintarHoja(true);
    hoja.focus();
  }
  function cerrar(sinFoco) {
    document.querySelectorAll('.velo,.hoja,.dlg').forEach(x => x.remove()); document.body.style.overflow = ''; document.body.classList.remove('con-hoja');
    const A = st.abierta; st.abierta = null; if (!A || sinFoco) return;
    // la casilla de origen pudo rehacerse mientras estaba abierta: se busca la de esa publicación que se vea
    const o = A.origen && A.origen.isConnected ? A.origen : [...document.querySelectorAll(`[data-pid="${A.pid}"]`)].find(x => x.offsetParent);
    if (o) o.focus();
  }
  function pintarHoja(nueva) {
    const A = st.abierta, hoja = document.querySelector('.hoja'); if (!A || !hoja) return;
    const p = st.d.pubs.find(x => x.pid === A.pid); if (!p || !p.visible) return cerrar();
    const cli = st.clientes.find(c => c.id === st.cli) || {}, coms = st.d.coms.filter(c => c.pid === p.pid), aprs = st.d.aprs.filter(a => a.pid === p.pid);
    const ultimaMia = [...aprs].reverse().find(a => a.decision !== 'retirada');
    // si ya existe, solo se rehacen las partes (el campo de escribir no se toca mientras se escribe: lección 92)
    let escr = hoja.querySelector('.escr');
    const otraVersion = !nueva && A.version && A.version !== p.version;
    if (otraVersion) { A.slide = 1; A.tog = null; }
    const ig = nueva || otraVersion || !hoja.querySelector('.ig') ? pintarIg(p) : hoja.querySelector('.ig');
    // como Instagram (D-295): el caption, arriba de lo que se desliza con los comentarios
    const capEl = p.caption ? h('p', { class: 'cap' }, h('b', { text: (cli.handle || cli.nombre || '') + ' ' }), p.caption) : null;
    const hilo = h('ol', {}, [
      ...coms.map(c => ({ t: c.hora, el: h('li', { class: 'cm' + (c.de_kevin ? ' kv' : '') }, h('span', { class: 'q' }, h('b', { text: c.autor_nombre }), cuando(c.hora), c.version !== p.version ? ' · de una versión anterior' : ''),
        c.diapositiva ? h('span', { class: 'sl', text: 'Diapositiva ' + c.diapositiva }) : null, h('p', { text: c.texto })) })),
      ...aprs.filter(a => a.decision === 'cambios').map(a => ({ t: a.hora, el: h('li', { class: 'cm dec' }, h('span', { class: 'q' }, h('b', { text: a.autor_nombre }), cuando(a.hora) + ' · pidió cambios' + (a.version !== p.version ? ' · de una versión anterior' : '')),
        a.diapositiva ? h('span', { class: 'sl', text: 'Diapositiva ' + a.diapositiva }) : null, h('p', { text: a.motivo })) })),
    ].sort((x, y) => x.t.localeCompare(y.t)).map(x => x.el));
    if (!escr) {
      const mira = soloMira();   // la cuenta que solo mira: el campo y el botón, apagados en su sitio (D-266)
      const ta = h('textarea', { rows: '1', placeholder: mira ? 'Solo mirar: aquí no se comenta' : 'Escribe un comentario…', 'aria-label': 'Comentario', maxlength: '2000', disabled: mira, title: mira ? POR : null });
      if (!mira) ta.value = borrador(p.pid);
      const env = h('button', { type: 'button', class: 'env', 'aria-label': 'Enviar comentario', disabled: mira || !ta.value.trim(), title: mira ? POR : null }, ico('send'));
      const tog = h('button', { type: 'button', class: 'tog', 'aria-pressed': 'false', hidden: true }, ico('check'), h('span'));
      const err = h('p', { class: 'err-p', role: 'alert', hidden: true });
      ta.addEventListener('input', () => { if (soloMira()) return; lsSet('portal-borrador-' + p.pid, ta.value); env.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; });
      tog.addEventListener('click', () => { const v = tog.getAttribute('aria-pressed') !== 'true'; tog.setAttribute('aria-pressed', String(v)); if (st.abierta) st.abierta.tog = v; });
      env.addEventListener('click', async () => {
        const t = ta.value.trim(); if (!t || soloMira()) return; env.disabled = true; err.hidden = true;
        try {
          const dia = tog.hidden || tog.getAttribute('aria-pressed') !== 'true' ? null : st.abierta.slide;
          st.gen++;
          const fila = await S.insertar(`comentarios?select=${C_COM}`, [{ cliente_id: st.cli, pid: p.pid, version: (st.abierta && st.abierta.version) || p.version, diapositiva: dia, texto: t }], { devolver: true });
          st.gen++; st.d.coms.push(...(fila || [])); ta.value = ''; lsSet('portal-borrador-' + p.pid, null); ta.style.height = '';
          pintarHoja(); pintar();
        } catch (e) { err.textContent = msgError(e); err.hidden = false; env.disabled = false; if (e.status === 409) await refrescar(true); }
      });
      escr = h('div', { class: 'escr' }, tog, h('div', { class: 'fila' }, ta, env), err);
    }
    const tog = escr.querySelector('.tog'), nImg = p.imagenes.length;
    tog.hidden = nImg < 2; tog.lastChild.textContent = 'Sobre la diapositiva ' + A.slide;
    if (nueva || otraVersion) tog.setAttribute('aria-pressed', 'false');
    const cambiado = ultimaMia && ultimaMia.version !== p.version;
    const cab = h('div', { class: 'dl-h' }, h('h2', { id: 'h-pub', text: p.nombre }), h('p', { text: fechaPub(p) }), pildora(p, ultimaMia));
    const aviso = otraVersion ? h('p', { class: 'cambio', role: 'status' }, ico('hist'), 'Kevin acaba de cambiarla: esto es lo nuevo.')
      : cambiado ? h('p', { class: 'cambio' }, ico('hist'), 'Ha cambiado después de tu última decisión: míralo otra vez.') : null;
    const lista = coms.length || aprs.some(a => a.decision === 'cambios') ? hilo : h('p', { class: 'vacio', text: soloMira() ? 'Aún no hay comentarios.' : 'Aún no hay comentarios. Si algo no te encaja, dilo aquí.' });
    const acc = acciones(p, ultimaMia), dl0 = hoja.querySelector('.dl');
    A.version = p.version;
    // la proporción de la foto (la de la primera, entre 9:16 y 1,91:1, como Instagram): la ventana la sigue (portal.css)
    const im0 = p.imagenes[0], prop = im0 && im0.an > 0 && im0.al > 0 ? Math.min(1.91, Math.max(0.5625, im0.an / im0.al)) : 0.8;
    hoja.style.setProperty('--r', prop.toFixed(4));   // CSSOM: la CSP lo deja (lección 243)
    if (nueva || !dl0) {
      const x = h('button', { type: 'button', class: 'hoja-x', 'aria-label': 'Cerrar', onclick: () => cerrar() }, ico('x'));
      hoja.replaceChildren(x, cuentaDe(cli), ig, h('div', { class: 'dl' }, cab, h('div', { class: 'dl-b' }, aviso, capEl, h('div', { class: 'hilo' }, h('h3', { text: 'Comentarios' }), lista)), h('div', { class: 'dl-pie' }, escr, acc)));
    } else {   // solo cambia lo que cambió; el campo de escribir se queda donde está, con su foco
      const b = dl0.querySelector('.dl-b');
      if (otraVersion) { hoja.querySelector('.ig').replaceWith(ig); b.querySelector(':scope > .cap')?.remove(); if (capEl) b.querySelector(':scope > .hilo').before(capEl); }
      dl0.querySelector('.dl-h').replaceWith(cab);
      b.querySelector(':scope > .cambio')?.remove(); if (aviso) b.prepend(aviso);
      b.querySelector('.hilo > ol, .hilo > p.vacio').replaceWith(lista);
      dl0.querySelector('.acc').replaceWith(acc);
    }
    if (nueva || otraVersion) mostrarImagenes(p);
  }
  function pildora(p, ultima) {
    const [t, k] = ESTADO[p.estado];
    const extra = ultima && ['aprobada', 'cambios'].includes(p.estado) && ultima.version === p.version ? ` · ${ultima.autor_nombre}, ${cuando(ultima.hora)}` : '';
    return h('span', { class: 'est ' + k }, k === 'ap' ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : k === 'cb' ? ico('pen') : k === 'ok' ? ico('check') : null, t + extra);
  }
  function siguientePendiente(pid) { const l = pendientes().filter(x => x.pid !== pid); return l[0] || null; }
  function acciones(p, ultima) {
    const a = accionesDe(p, ultima);
    if (soloMira()) {   // D-266: los botones en su sitio, apagados, y una línea que dice por qué (el «Siguiente por aprobar» sigue)
      const bs = [...a.querySelectorAll('.btn')];
      bs.forEach(b => { b.disabled = true; b.title = POR; });
      if (bs.length) a.append(h('p', { class: 'por', text: POR }));
    }
    return a;
  }
  function accionesDe(p, ultima) {
    const sig = siguientePendiente(p.pid), sigBtn = sig ? h('button', { type: 'button', class: 'lnk sig', onclick: () => abrir(sig.pid, true) }, 'Siguiente por aprobar', ico('right')) : null;
    if (p.estado === 'por_aprobar') return h('div', { class: 'acc' },
      h('button', { type: 'button', class: 'btn s', onclick: () => pedirCambios(p) }, ico('pen'), 'Pedir cambios'),
      h('button', { type: 'button', class: 'btn p', onclick: e => decidir(p, 'aprobada', null, null, e.currentTarget) }, ico('check'), 'Aprobar'));
    if (p.estado === 'aprobada' || p.estado === 'cambios') return h('div', { class: 'acc' },
      h('div', { class: 'hecho' + (p.estado === 'cambios' ? ' cb' : '') }, ico(p.estado === 'cambios' ? 'pen' : 'check'), h('b', { text: p.estado === 'cambios' ? 'Pediste cambios' : 'Aprobada' })),
      p.estado === 'cambios' ? h('button', { type: 'button', class: 'btn p', onclick: e => decidir(p, 'aprobada', null, null, e.currentTarget) }, ico('check'), 'Aprobar') : null,
      h('button', { type: 'button', class: 'btn s', onclick: e => decidir(p, 'retirada', null, null, e.currentTarget) }, ico('undo'), 'Deshacer'), sigBtn);
    const txt = { preparando: 'Aún la estamos preparando: te avisaremos para que la apruebes.', programada: 'Ya está programada.', publicada: 'Ya está publicada.' }[p.estado];
    return h('div', { class: 'acc quieta' }, h('p', { class: 'vacio', text: txt }), sigBtn);   // nada que decidir: en el móvil no tapa el campo de comentar
  }
  async function decidir(p0, decision, motivo, diapositiva, boton) {
    if (boton) boton.disabled = true;
    const pid = p0.pid, A = st.abierta, version = A && A.pid === pid && A.version ? A.version : p0.version;   // lo que tiene delante
    try {
      st.gen++;
      const fila = await S.insertar(`aprobaciones?select=${C_APR}`, [{ cliente_id: st.cli, pid, version, decision, motivo, diapositiva }], { devolver: true });
      st.gen++;
      st.d.aprs.push(...(fila || []));
      const p = st.d.pubs.find(x => x.pid === pid);   // un repaso pudo traer otra lista mientras tanto (lección 97)
      if (p) p.estado = decision === 'aprobada' ? 'aprobada' : decision === 'cambios' ? 'cambios' : 'por_aprobar';
      toast(decision === 'aprobada' ? 'Aprobada. Queda lista para programar.' : decision === 'cambios' ? 'Enviado: Kevin verá lo que cambiarías.' : 'Hecho: vuelve a esperar tu decisión.');
      pintar(); pintarHoja();
      return true;
    } catch (e) {
      toast(msgError(e)); if (boton && boton.isConnected) boton.disabled = false;
      if (e.status === 409) { document.querySelectorAll('.dlg,.velo.alto').forEach(x => x.remove()); await refrescar(true); }
      return false;
    }
  }
  function pedirCambios(p) {
    const clave = 'portal-motivo-' + p.pid, origen = document.activeElement;
    const ta = h('textarea', { 'aria-label': 'Qué cambiarías', maxlength: '2000' }), enviar = h('button', { type: 'button', class: 'btn p', text: 'Enviar' });
    ta.value = lsGet(clave) || ''; enviar.disabled = !ta.value.trim();
    const tog = p.imagenes.length > 1 ? h('button', { type: 'button', class: 'tog', 'aria-pressed': String(st.abierta.slide > 1) }, ico('check'), 'Sobre la diapositiva ' + st.abierta.slide) : null;
    if (tog) tog.addEventListener('click', () => tog.setAttribute('aria-pressed', String(tog.getAttribute('aria-pressed') !== 'true')));
    ta.addEventListener('input', () => { enviar.disabled = !ta.value.trim(); lsSet(clave, ta.value); });
    const velo = h('div', { class: 'velo alto' });
    const quitar = () => {
      velo.remove(); dlg.remove();
      if (st.sucio) { st.sucio = false; pintar(); pintarHoja(); }   // lo que llegó mientras estaba abierto
      const o = origen && origen.isConnected ? origen : document.querySelector('.hoja .acc .btn.s') || document.querySelector('.hoja');
      if (o) o.focus();
    };
    const dlg = h('section', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'h-camb' },
      h('h2', { id: 'h-camb', text: '¿Qué cambiarías?' }), h('p', { text: `${p.nombre} · ${fechaPub(p)}. Kevin lo verá en su Mesa.` }), tog, ta,
      h('div', { class: 'fila' }, h('button', { type: 'button', class: 'btn q', text: 'Cancelar', onclick: quitar }), enviar));
    dlg._quitar = quitar;
    velo.addEventListener('click', quitar);
    enviar.addEventListener('click', async () => { const ok = await decidir(p, 'cambios', ta.value.trim(), tog && tog.getAttribute('aria-pressed') === 'true' ? st.abierta.slide : null, enviar); if (ok) { lsSet(clave, null); quitar(); } });
    document.body.append(velo, dlg); ta.focus(); ta.scrollIntoView({ block: 'nearest' });   // también con el teclado ya abierto
  }
  // la cuenta, arriba de la columna de la derecha (en el móvil, arriba del todo, con «Volver») (D-295)
  function cuentaDe(cli) {
    const av = h('span', { class: 'ig-av', 'aria-hidden': 'true', text: (cli.nombre || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() });
    if (cli.foto) urls([cli.foto]).then(m => { if (m[cli.foto]) av.replaceChildren(h('img', { src: m[cli.foto], alt: '' })); }).catch(() => {});
    return h('div', { class: 'ig-h' }, h('button', { type: 'button', class: 'bk', onclick: () => cerrar() }, ico('left'), 'Volver'), av, h('span', { text: cli.handle || cli.nombre || '' }));
  }
  function pintarIg(p) {
    const lista = h('div', { class: 'car-l', tabindex: '0', 'aria-label': p.imagenes.length > 1 ? `${p.imagenes.length} imágenes: desliza para verlas` : 'Imagen de la publicación' },
      p.imagenes.length ? p.imagenes.map((im, i) => h('div', {}, h('img', { alt: `Imagen ${i + 1} de ${p.imagenes.length}`, 'data-grande': im.ruta, width: String(im.an), height: String(im.al) }))) : h('div', {}, h('div', { class: 'ph', text: 'En preparación' })));
    const n = h('span', { class: 'ig-n', text: p.imagenes.length > 1 ? `1 / ${p.imagenes.length}` : '' }); if (p.imagenes.length < 2) n.hidden = true;
    const dots = h('div', { class: 'ig-dots', 'aria-hidden': 'true', hidden: p.imagenes.length < 2 }, p.imagenes.length > 1 ? p.imagenes.map((_, i) => h('i', { class: i ? null : 'on' })) : null);
    const ant = h('button', { type: 'button', class: 'car-b ant', 'aria-label': 'Imagen anterior', hidden: true }, ico('left'));
    const sig = h('button', { type: 'button', class: 'car-b sig', 'aria-label': 'Imagen siguiente', hidden: p.imagenes.length < 2 }, ico('right'));
    const ir = d => lista.scrollTo({ left: lista.clientWidth * (st.abierta.slide - 1 + d), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    ant.addEventListener('click', () => ir(-1)); sig.addEventListener('click', () => ir(1));
    lista.addEventListener('scroll', () => {
      const i = Math.round(lista.scrollLeft / Math.max(1, lista.clientWidth)) + 1; if (!st.abierta || i === st.abierta.slide) return;
      st.abierta.slide = i; n.textContent = `${i} / ${p.imagenes.length}`; [...dots.children].forEach((d, j) => d.className = j === i - 1 ? 'on' : '');
      ant.hidden = i <= 1; sig.hidden = i >= p.imagenes.length;
      const tog = document.querySelector('.hoja .escr .tog'); if (tog) { tog.lastChild.textContent = 'Sobre la diapositiva ' + i; if (st.abierta.tog == null) tog.setAttribute('aria-pressed', String(i > 1)); }
    }, { passive: true });
    lista.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); ir(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); } });
    return h('div', { class: 'ig' }, h('div', { class: 'car' }, lista, n, ant, sig), dots);
  }
  async function mostrarImagenes(p) {
    const imgs = [...document.querySelectorAll('.hoja img[data-grande]')]; if (!imgs.length) return;
    try { const m = await urls(imgs.map(i => i.dataset.grande)); for (const i of imgs) if (m[i.dataset.grande] && i.isConnected) { i.src = m[i.dataset.grande]; i.addEventListener('error', otraVez, { once: true }); } }
    catch (e) { toast('No se pudieron cargar las imágenes: ' + msgError(e)); }
  }

  // ---------- repaso: lo nuevo, sin cerrar ni borrar lo que se escribe ----------
  async function refrescar(forzar) {
    if (!S || !S.usuario() || !st.cli || (document.hidden && !forzar)) return;
    const gen = st.gen, n = st.carga, cli = st.cli;
    try {
      const d = await cargarDatos(cli, st.d);
      if (gen !== st.gen || n !== st.carga || cli !== st.cli) return;   // algo se escribió o se cambió de cuenta mientras se leía: lo leído ya es viejo
      if (!forzar && JSON.stringify(d) === JSON.stringify(st.d)) return;
      st.d = d; if (!mesesDisponibles().includes(st.mes)) st.mes = mesInicial();
      if (document.querySelector('.dlg')) { st.sucio = true; return; }   // se repinta al cerrar el diálogo
      st.sucio = false; pintar(); pintarHoja();
    } catch (e) { if (e.status === 401 || e.codigo === 'sesion') pintarEntrada('correo', lsGet('portal-correo') || '', 'Tu sesión ha caducado: vuelve a entrar.'); }
  }
  setInterval(() => refrescar(), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Tab') {   // el foco no sale del diálogo de encima
      const top = document.querySelector('.dlg') || document.querySelector('.hoja'); if (!top) return;
      const f = [...top.querySelectorAll('button,textarea,input,a[href],[tabindex="0"]')].filter(x => !x.disabled && x.offsetParent !== null);   // the links of a session's sheet too (D-378)
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      return;
    }
    if (e.key !== 'Escape') return;
    const d = document.querySelector('.dlg'); if (d) { if (d._quitar) d._quitar(); else { d.remove(); document.querySelector('.velo.alto')?.remove(); } return; }
    if (st.abierta) cerrar();
  });
  if (S) S.alCambiar(u => { if (!u && st.d) pintarEntrada('correo', lsGet('portal-correo') || ''); });
  // el teclado: su alto en --kb. Cuando cambia con un diálogo abierto, lo que se escribe se pone a la vista, sobre los botones
  if (window.visualViewport) {
    const vv = window.visualViewport; let antes = 0;
    const kb = () => {
      const alto = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
      document.documentElement.style.setProperty('--kb', alto + 'px');
      if (alto === antes) return; antes = alto;
      const a = document.activeElement; if (a && a.closest && a.closest('.dlg')) a.scrollIntoView({ block: 'nearest' });
    };
    vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb);
  }
  window.PORTAL = { version: V, _st: st, refrescar };
  arrancar();
})();
